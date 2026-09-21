import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';
import { TemplateService } from '../templates/template.service';
import { Template, TemplateComponente, TemplateBotaoForm, HeaderState, headerStateVazio, parseComponentes } from '../templates/template.models';
import { TemplatePreviewComponent } from '../templates/template-preview/template-preview';
import { AgendamentoService } from './agendamento.service';
import {
  Agendamento, AgendamentoExecucao, AgendamentoVariavel, OrigemVariavelAgendamento,
  DIAS_DA_SEMANA, ROTULO_RECORRENCIA, TipoRecorrencia, descricaoRecorrencia, resumoDiasSemana
} from './agendamento.models';
import { ParametroService } from '../parametros/parametro.service';
import {
  CAMPOS_DO_CONTATO, ParametroEmpresa, dicaDaVariavel, selecaoDaVariavel,
  valorDaVariavel as resolverValorDaVariavel, variavelDaSelecao, variavelIncompleta
} from '../../shared/variaveis/variavel-template';

interface Contato {
  id: string;
  nomeContato?: string;
  telefone: string;
  email?: string;
  checked?: boolean;
  nomeCliente?: string | null;
  diaVencimento?: number | null;
  valorFatura?: number | null;
  taxaJuros?: number | null;
  taxaJurosMensal?: number | null;
}

interface TemplateAgendamento extends Template {
  componentesParsed?: TemplateComponente[]; // Cache local pós-parse
}

@Component({
  selector: 'app-agendamentos',
  standalone: true,
  imports: [CommonModule, FormsModule, TemplatePreviewComponent],
  templateUrl: './agendamentos.component.html',
  styleUrls: ['../shared-crud.css', './agendamentos.component.css'],
})
export class AgendamentosComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private templateService = inject(TemplateService);
  private agendamentoService = inject(AgendamentoService);
  private parametroService = inject(ParametroService);

  private readonly API_CONTATO = `${environment.apiUrl}/contato`;

  private empresaId = this.authService.empresaIdSignal;
  private userId = this.authService.usuarioIdSignal;

  readonly rotuloRecorrencia = ROTULO_RECORRENCIA;
  readonly diasDaSemana = DIAS_DA_SEMANA;
  readonly descricaoRecorrencia = descricaoRecorrencia;
  readonly diasDoMes = Array.from({ length: 31 }, (_, i) => i + 1);

  agendamentos = signal<Agendamento[]>([]);
  templates = signal<TemplateAgendamento[]>([]);
  contatos = signal<Contato[]>([]);
  search = signal('');
  response = signal('');
  salvando = signal(false);
  editingId = signal<string | null>(null);

  historicoAbertoId = signal<string | null>(null);
  execucoes = signal<AgendamentoExecucao[]>([]);
  carregandoHistorico = signal(false);

  form = signal({
    nome: '',
    templateId: '',
    tipoRecorrencia: 'DIARIA' as TipoRecorrencia,
    dataInicio: '',
    dataFim: '',
    dataReferencia: '',
    diasSemana: [] as number[],
    diaDoMes: null as number | null,
  });

  variaveis = signal<AgendamentoVariavel[]>([]);
  // Parâmetros cadastrados da empresa (tela Parâmetros), oferecidos como origem de cada variável.
  parametros = signal<ParametroEmpresa[]>([]);
  readonly camposDoContato = CAMPOS_DO_CONTATO;

  contatosFiltrados = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.contatos();
    return this.contatos().filter(c =>
      (c.nomeContato && c.nomeContato.toLowerCase().includes(termo)) ||
      c.telefone.includes(termo) ||
      (c.email && c.email.toLowerCase().includes(termo))
    );
  });

  selecionados = computed(() => this.contatos().filter(c => c.checked));

  isAllSelected = computed(() => {
    const filtrados = this.contatosFiltrados();
    if (filtrados.length === 0) return false;
    return filtrados.every(c => c.checked);
  });

  // Captura o objeto de template atualmente ativo e faz o parse do componentesJson (header/
  // footer/botões) -- mesmo padrão do Disparador, pra prévia funcionar com qualquer tipo de
  // template (texto puro, com mídia no cabeçalho, com botões...), não só o corpo.
  templateAtivo = computed(() => {
    const tplId = this.form().templateId;
    const tpl = this.templates().find(t => t.id === tplId);
    if (!tpl) return null;

    if (!tpl.componentesParsed) {
      tpl.componentesParsed = parseComponentes(tpl.componentesJson);
    }
    return tpl;
  });

  headerPreview = computed<HeaderState>(() => {
    const tpl = this.templateAtivo();
    if (!tpl?.componentesParsed) return headerStateVazio();

    const headerComp = tpl.componentesParsed.find(c => c.Tipo === 0);
    if (!headerComp || headerComp.FormatMidia === 0) return headerStateVazio();

    const tipoPorFormato: HeaderState['tipo'][] = ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'];
    return {
      tipo: tipoPorFormato[headerComp.FormatMidia] ?? 'NONE',
      texto: headerComp.Texto || '',
      exemploHandle: '',
      exemploNomeArquivo: '',
    };
  });

  footerPreview = computed(() => {
    const tpl = this.templateAtivo();
    const footerComp = tpl?.componentesParsed?.find(c => c.Tipo === 2);
    return footerComp?.Texto || '';
  });

  botoesPreview = computed(() => {
    const tpl = this.templateAtivo();
    const botoesComp = tpl?.componentesParsed?.find(c => c.Tipo === 3);
    if (!botoesComp?.Botoes) return [];
    const tipoPorIndice: TemplateBotaoForm['tipo'][] = ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'];
    return botoesComp.Botoes.map(b => ({
      tipo: tipoPorIndice[b.Tipo] ?? 'QUICK_REPLY',
      texto: b.Texto,
      url: b.Url,
      numeroTelefone: b.NumeroTelefone,
      codigoExemplo: b.CodigoExemplo,
    }));
  });

  // Como a mensagem fica pra um contato de exemplo (o primeiro selecionado, se houver), com as
  // variáveis já resolvidas -- é o que a tela pedia: "mostre um preview de como ficaria esse
  // template, aplicando as variáveis".
  contatoDaPrevia = computed(() => this.selecionados()[0] || null);

  textoPreview = computed(() => {
    const tpl = this.templateAtivo();
    if (!tpl) return '';

    const exemplo = this.contatoDaPrevia();
    let texto = tpl.conteudo;

    this.variaveis().forEach((v, index) => {
      const valor = (this.valorDaVariavel(v, exemplo) || `campo ${index + 1}`).trim();
      texto = texto.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), valor);
    });

    return texto;
  });

  // Frase pronta explicando quando o disparo acontece, pra não depender do usuário decifrar
  // "Semanal" + os chips marcados + a data de referência mentalmente.
  resumoRecorrenciaTexto = computed(() => {
    const f = this.form();
    if (!f.dataReferencia) return 'Informe a data e hora de referência para ver o resumo.';

    const hora = f.dataReferencia.slice(11, 16);
    if (!hora) return '';

    if (f.tipoRecorrencia === 'DIARIA') return `Todos os dias, às ${hora}.`;

    if (f.tipoRecorrencia === 'SEMANAL') {
      if (f.diasSemana.length === 0) return 'Marque ao menos um dia da semana abaixo.';
      return `Toda(o) ${resumoDiasSemana(f.diasSemana)}, às ${hora}.`;
    }

    if (f.tipoRecorrencia === 'MENSAL') {
      const dia = f.diaDoMes ?? (f.dataReferencia ? new Date(f.dataReferencia).getDate() : null);
      return dia ? `Todo dia ${dia} do mês, às ${hora}.` : '';
    }

    if (f.tipoRecorrencia === 'VENCIMENTO_CONTATO') {
      return `Verifica todo dia, às ${hora}, e envia só para os contatos que vencem naquele dia (dia de vencimento cadastrado em cada contato).`;
    }

    return '';
  });

  ngOnInit() {
    this.buscarAgendamentos();
    this.buscarTemplates();
    this.buscarContatos();
    this.buscarParametros();
  }

  buscarParametros() {
    const empId = this.empresaId();
    if (!empId) return;
    this.parametroService.listar(empId).subscribe({
      next: (res) => this.parametros.set(res),
      // Sem parâmetros o resto da tela continua funcionando (só some a opção no seletor).
      error: () => this.parametros.set([])
    });
  }

  buscarAgendamentos() {
    const empId = this.empresaId();
    if (!empId) return;
    this.agendamentoService.listar(empId).subscribe({
      next: (res) => this.agendamentos.set(res),
      error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao carregar agendamentos.')}`)
    });
  }

  buscarTemplates() {
    const empId = this.empresaId();
    if (!empId) return;
    this.templateService.listar(empId).subscribe({
      next: (res) => this.templates.set((res as TemplateAgendamento[]).filter(t => t.status?.toUpperCase() === 'APPROVED')),
      error: () => this.response.set('❌ Erro ao carregar modelos de mensagem.')
    });
  }

  buscarContatos() {
    const uid = this.userId();
    if (!uid) return;
    this.http.get<Contato[]>(`${this.API_CONTATO}/obter-por-usuario/${uid}`)
      .subscribe({
        next: (res) => this.contatos.set(res.map(c => ({ ...c, checked: false }))),
        error: () => this.response.set('❌ Erro ao carregar contatos.')
      });
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  // Ao trocar o modelo, detecta as variáveis {{n}} do corpo e monta um campo para cada uma --
  // {{1}} quase sempre é o nome do cliente, então já sai marcado assim (mesmo comportamento
  // do Disparador). Sem isto, um agendamento com template de variável saía sem nenhum
  // parâmetro e a Meta recusava o disparo.
  onTemplateChange(templateId: string) {
    this.update('templateId', templateId);

    const tpl = this.templates().find(t => t.id === templateId);
    if (!tpl) {
      this.variaveis.set([]);
      return;
    }

    const matches = tpl.conteudo.match(/\{\{\d+\}\}/g) || [];
    this.variaveis.set(matches.map((_, i) => ({
      origem: (i === 0 ? 'nome' : 'fixo') as OrigemVariavelAgendamento,
      valorFixo: ''
    })));
  }

  updateVariavel(index: number, mudanca: Partial<AgendamentoVariavel>) {
    const lista = [...this.variaveis()];
    lista[index] = { ...lista[index], ...mudanca };
    this.variaveis.set(lista);
  }

  // Valor do <select> de origem da variável ('fixo', campo do contato ou 'parametro:<id>').
  selecaoDaVariavel(v: AgendamentoVariavel): string {
    return selecaoDaVariavel(v);
  }

  trocarOrigem(index: number, selecao: string) {
    this.updateVariavel(index, variavelDaSelecao(selecao));
  }

  dicaDaVariavel(v: AgendamentoVariavel): string {
    return dicaDaVariavel(v, this.parametros());
  }

  // Resolve o valor de uma variável para um contato de exemplo. Sem contato selecionado (prévia
  // sem seleção), devolve um exemplo visível em vez de vazio -- senão a prévia mostra "campo N"
  // pra tudo antes do usuário marcar alguém na lista. Mesmas regras e formatação (pt-BR, 2
  // casas, data de vencimento no mês atual) que o backend usa de verdade no disparo (ver
  // ResolvedorDeVariaveis).
  private valorDaVariavel(v: AgendamentoVariavel, contato: Contato | null): string {
    return resolverValorDaVariavel(v, contato, this.parametros());
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByContatoId(_index: number, contato: Contato): string {
    return contato.id;
  }

  toggleContato(contato: Contato) {
    this.contatos.update(list => list.map(c =>
      c.id === contato.id ? { ...c, checked: !c.checked } : c
    ));
  }

  selAll() {
    const marcarTodos = !this.isAllSelected();
    const filtradosIds = this.contatosFiltrados().map(c => c.id);
    this.contatos.update(list => list.map(c =>
      filtradosIds.includes(c.id) ? { ...c, checked: marcarTodos } : c
    ));
  }

  toggleDiaSemana(valor: number) {
    const atual = this.form().diasSemana;
    const diasSemana = atual.includes(valor)
      ? atual.filter(d => d !== valor)
      : [...atual, valor].sort((a, b) => a - b);
    this.update('diasSemana', diasSemana);
  }

  salvar() {
    const f = this.form();
    const empId = this.empresaId();
    const alvos = this.selecionados();

    if (!f.nome.trim()) {
      this.response.set('❌ Informe o nome do agendamento.');
      return;
    }
    if (!f.templateId) {
      this.response.set('❌ Escolha o modelo de mensagem.');
      return;
    }
    if (!f.dataInicio) {
      this.response.set('❌ Informe a data de início da vigência.');
      return;
    }
    if (!f.dataReferencia) {
      this.response.set('❌ Informe a data e hora de referência do disparo.');
      return;
    }
    if (f.tipoRecorrencia === 'SEMANAL' && f.diasSemana.length === 0) {
      this.response.set('❌ Marque ao menos um dia da semana para a recorrência semanal.');
      return;
    }
    if (this.variaveis().some(v => variavelIncompleta(v, this.parametros()))) {
      this.response.set('❌ Preencha o que entra em cada campo variável da mensagem (texto ou parâmetro).');
      return;
    }
    if (alvos.length === 0) {
      this.response.set('❌ Marque pelo menos um contato para o agendamento.');
      return;
    }
    if (!empId) {
      this.response.set('❌ Sessão expirada. Faça login novamente.');
      return;
    }

    const contatoIds = alvos.map(c => c.id);
    const dataInicio = `${f.dataInicio}T00:00:00`;
    const dataFim = f.dataFim ? `${f.dataFim}T23:59:59` : null;
    const variaveis = this.variaveis();
    // Só manda o que é relevante pro tipo escolhido -- diasSemana só faz sentido em SEMANAL,
    // diaDoMes só em MENSAL; mandar os dois sempre deixaria estado velho gravado no banco caso
    // o usuário troque de tipo de recorrência antes de salvar.
    const diasSemana = f.tipoRecorrencia === 'SEMANAL' ? f.diasSemana : [];
    const diaDoMes = f.tipoRecorrencia === 'MENSAL' ? f.diaDoMes : null;

    this.salvando.set(true);

    const request = this.editingId()
      ? this.agendamentoService.atualizar({
          id: this.editingId(),
          nome: f.nome.trim(),
          templateId: f.templateId,
          tipoRecorrencia: f.tipoRecorrencia,
          dataInicio,
          dataFim,
          dataReferencia: f.dataReferencia,
          contatoIds,
          variaveis,
          diasSemana,
          diaDoMes,
        })
      : this.agendamentoService.incluir({
          empresaId: empId,
          nome: f.nome.trim(),
          templateId: f.templateId,
          tipoRecorrencia: f.tipoRecorrencia,
          dataInicio,
          dataFim,
          dataReferencia: f.dataReferencia,
          contatoIds,
          usuarioCriacaoId: this.userId(),
          variaveis,
          diasSemana,
          diaDoMes,
        });

    request.subscribe({
      next: () => {
        this.salvando.set(false);
        this.response.set('✅ Agendamento salvo com sucesso!');
        this.cancelarEdicao();
        this.buscarAgendamentos();
      },
      error: (err) => {
        this.salvando.set(false);
        this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao salvar o agendamento.')}`);
      }
    });
  }

  prepararEdicao(a: Agendamento) {
    this.agendamentoService.obter(a.id).subscribe({
      next: (detalhe) => {
        this.editingId.set(detalhe.id);
        this.form.set({
          nome: detalhe.nome,
          templateId: detalhe.templateId,
          tipoRecorrencia: detalhe.tipoRecorrencia,
          dataInicio: paraDataCurta(detalhe.dataInicio),
          dataFim: detalhe.dataFim ? paraDataCurta(detalhe.dataFim) : '',
          dataReferencia: paraDatetimeLocal(detalhe.dataReferencia),
          diasSemana: detalhe.diasSemana || [],
          diaDoMes: detalhe.diaDoMes ?? null,
        });
        this.variaveis.set(detalhe.variaveis || []);
        this.contatos.update(list => list.map(c => ({ ...c, checked: detalhe.contatoIds.includes(c.id) })));
        this.response.set('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao carregar o agendamento.')}`)
    });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({
      nome: '', templateId: '', tipoRecorrencia: 'DIARIA', dataInicio: '', dataFim: '', dataReferencia: '',
      diasSemana: [], diaDoMes: null,
    });
    this.variaveis.set([]);
    this.contatos.update(list => list.map(c => ({ ...c, checked: false })));
  }

  pausarRetomar(a: Agendamento) {
    this.agendamentoService.alterarStatus(a.id, !a.ativo).subscribe({
      next: () => {
        this.response.set(a.ativo ? '⏸ Agendamento pausado.' : '▶ Agendamento retomado.');
        this.buscarAgendamentos();
      },
      error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao alterar o agendamento.')}`)
    });
  }

  excluir(a: Agendamento) {
    if (!confirm(`Excluir o agendamento "${a.nome}"? Essa ação não pode ser desfeita.`)) return;

    this.agendamentoService.excluir(a.id).subscribe({
      next: () => {
        this.agendamentos.update(lista => lista.filter(x => x.id !== a.id));
        this.response.set('✅ Agendamento excluído.');
        if (this.historicoAbertoId() === a.id) this.historicoAbertoId.set(null);
      },
      error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao excluir o agendamento.')}`)
    });
  }

  toggleHistorico(a: Agendamento) {
    if (this.historicoAbertoId() === a.id) {
      this.historicoAbertoId.set(null);
      return;
    }

    this.historicoAbertoId.set(a.id);
    this.carregandoHistorico.set(true);
    this.execucoes.set([]);

    this.agendamentoService.listarExecucoes(a.id).subscribe({
      next: (res) => {
        this.execucoes.set(res);
        this.carregandoHistorico.set(false);
      },
      error: (err) => {
        this.carregandoHistorico.set(false);
        this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao carregar o histórico.')}`);
      }
    });
  }
}

// "2026-09-20T14:30:00" (o que a API devolve) -> "2026-09-20T14:30" (o que <input type="datetime-local"> aceita)
function paraDatetimeLocal(iso: string): string {
  return iso?.slice(0, 16) || '';
}

// "2026-09-20T23:59:59" -> "2026-09-20" (o que <input type="date"> aceita)
function paraDataCurta(iso: string): string {
  return iso?.slice(0, 10) || '';
}
