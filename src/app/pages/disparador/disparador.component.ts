import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';
import { TemplateService } from '../templates/template.service';
import { Template, TemplateComponente, parseComponentes } from '../templates/template.models';
import { AssistenteIaBotaoComponent } from '../../shared/assistente-ia/assistente-ia-botao';
import { ParametroService } from '../parametros/parametro.service';
import {
  CAMPOS_DO_CONTATO, ParametroEmpresa, VariavelTemplate, dependeDoContato, dicaDaVariavel,
  selecaoDaVariavel, valorDaVariavel as resolverValorDaVariavel, variavelDaSelecao, variavelIncompleta
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

interface NumeroMeta {
  id: string;
  usuarioId: string;
  telefone: string;
  descricao: string;
  instanciaId: string;
  statusMeta: string | null;
  qualidadeMeta: string | null;
  dataCriacao: string;
}

interface TemplateMeta extends Template {
  componentesParsed?: TemplateComponente[]; // Cache local pós-parse
}

// De onde sai o valor de cada variável da mensagem: texto fixo, um dado de cada contato
// (resolvido na hora do envio) ou um Parâmetro cadastrado -- ver shared/variaveis/variavel-template.ts.
type VariavelBody = VariavelTemplate;

@Component({
  selector: 'app-disparador',
  standalone: true,
  imports: [CommonModule, FormsModule, AssistenteIaBotaoComponent],
  templateUrl: './disparador.component.html',
  styleUrls: ['../shared-crud.css', './disparador.component.css'],
})
export class DisparadorComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private templateService = inject(TemplateService);
  private parametroService = inject(ParametroService);

  private readonly API_CONTATO = `${environment.apiUrl}/contato`;
  private readonly API_NUMERO = `${environment.apiUrl}/numero`;
  private readonly API_DISPARO = `${environment.apiUrl}/disparador`;

  private empresaId = this.authService.empresaIdSignal;
  private userId = this.authService.usuarioIdSignal;

  // Signals de Estado
  contatos = signal<Contato[]>([]);
  templates = signal<TemplateMeta[]>([]);
  numerosAtivos = signal<NumeroMeta[]>([]);
  search = signal('');

  form = signal({
    templateId: '',
    instanciaId: '',
  });

  variaveis = signal<VariavelBody[]>([]);
  // Parâmetros cadastrados da empresa (tela Parâmetros), oferecidos como origem de cada variável.
  parametros = signal<ParametroEmpresa[]>([]);
  readonly camposDoContato = CAMPOS_DO_CONTATO;
  buttonParams = signal<{ value: string }[]>([]);
  headerMediaUrl = signal('');
  temMediaHeader = signal(false);
  response = signal('');
  errosLote = signal<{ telefone: string; erro: string }[]>([]);
  explicacaoTemplate = signal('');

  // Passo a passo: 1 escolher mensagem, 2 preencher o que muda, 3 escolher quem recebe,
  // 4 conferir e enviar. Envio custa dinheiro e não tem desfazer -- o passo 4 existe pra
  // ninguém disparar 500 mensagens de um clique sem ver o que vai sair.
  passo = signal(1);
  enviando = signal(false);

  // Computeds
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

  numeroEscolhido = computed(() => this.numerosAtivos().find(n => n.id === this.form().instanciaId) || null);

  // Captura o objeto de template atualmente ativo e realiza o Parse do JSON interno
  templateAtivo = computed(() => {
    const tplId = this.form().templateId;
    const tpl = this.templates().find(t => t.id === tplId);
    if (!tpl) return null;

    if (!tpl.componentesParsed) {
      tpl.componentesParsed = parseComponentes(tpl.componentesJson);
    }
    return tpl;
  });

  personalizado = computed(() => this.variaveis().some(v => dependeDoContato(v, this.parametros())));

  // Contatos que ficariam com uma variável vazia (sem nome cadastrado, por exemplo): a Meta
  // recusaria só o envio deles, no meio do lote, com erro cru.
  selecionadosIncompletos = computed(() => {
    const vars = this.variaveis();
    if (!this.personalizado()) return [];
    return this.selecionados().filter(c => vars.some(v => !this.valorDaVariavel(v, c).trim()));
  });

  // Como a mensagem fica para um contato específico (o primeiro selecionado, se houver)
  templatePreview = computed(() => {
    const tpl = this.templateAtivo();
    if (!tpl) return 'Escolha um modelo de mensagem para ver como ela fica.';

    const exemplo = this.selecionados()[0] || null;
    let texto = '';

    if (this.temMediaHeader()) {
      const url = this.headerMediaUrl().trim();
      texto += url ? `🖼️ [imagem/arquivo]: ${url}\n\n` : '🖼️ [imagem/arquivo do cabeçalho]\n\n';
    }

    texto += tpl.conteudo;

    this.variaveis().forEach((v, index) => {
      const valor = this.valorDaVariavel(v, exemplo).trim() || `[campo ${index + 1}]`;
      texto = texto.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), valor);
    });

    return texto;
  });

  contatoDaPrevia = computed(() => this.selecionados()[0] || null);

  // Instrução pro assistente de IA "explicar" o template selecionado -- não há campo
  // de texto livre nesta tela (só variáveis de um template já aprovado pela Meta), então
  // a IA ajuda de outra forma: traduzindo o template pro atendente entender o que vai
  // ser enviado e conseguir explicar pro cliente antes de disparar.
  instrucaoExplicarTemplate = computed(() => {
    const tpl = this.templateAtivo();
    if (!tpl) return '';
    return `Explique em 1-2 frases simples, para um atendente que não escreveu este template, o que esta mensagem de WhatsApp comunica ao cliente e quando ela deve ser usada.`;
  });

  ngOnInit() {
    this.buscarContatos();
    this.buscarTemplates();
    this.buscarNumeros();
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

  buscarContatos() {
    const uid = this.userId();
    if (!uid) return;
    this.http.get<Contato[]>(`${this.API_CONTATO}/obter-por-usuario/${uid}`)
      .subscribe({
        next: (res) => this.contatos.set(res.map(c => ({ ...c, checked: false }))),
        error: () => this.response.set('❌ Erro ao carregar contatos.')
      });
  }

  buscarTemplates() {
    const empId = this.empresaId();
    if (!empId) return;

    this.templateService.listar(empId)
      .subscribe({
        next: (res) => {
          const aprovados = (res as TemplateMeta[]).filter(t => t.status?.toUpperCase() === 'APPROVED');
          this.templates.set(aprovados);
        },
        error: () => this.response.set('❌ Erro ao carregar modelos de mensagem.')
      });
  }

  buscarNumeros() {
    const uid = this.userId();
    if (!uid) return;

    this.http.get<NumeroMeta[]>(`${this.API_NUMERO}/ListarNumeros/${uid}`)
      .subscribe({
        next: (res) => this.numerosAtivos.set(res),
        error: () => this.response.set('❌ Erro ao carregar os números conectados.')
      });
  }

  onTemplateChange(id: string) {
    this.updateForm('templateId', id);

    // Reseta os estados anteriores
    this.explicacaoTemplate.set('');
    this.headerMediaUrl.set('');
    this.variaveis.set([]);
    this.buttonParams.set([]);
    this.temMediaHeader.set(false);

    const tpl = this.templateAtivo();

    if (tpl && tpl.componentesParsed) {
      // 1. Captura variáveis dinâmicas do corpo
      const matches = tpl.conteudo.match(/\{\{\d+\}\}/g) || [];
      // {{1}} quase sempre é o nome do cliente: já sai marcado assim, que é o uso certo
      // do disparo em massa (e o que a tela antiga não permitia fazer).
      this.variaveis.set(matches.map((_, i) => ({
        origem: i === 0 ? 'nome' : 'fixo',
        valorFixo: ''
      } as VariavelBody)));

      // 2. CORREÇÃO AQUI: Procura usando 'Tipo' e 'FormatMidia' em maiúsculo
      const headerComp = tpl.componentesParsed.find(c => c.Tipo === 0);
      if (headerComp && [2, 3, 4].includes(headerComp.FormatMidia)) {
        this.temMediaHeader.set(true); // Isso vai forçar o HTML a exibir o campo!
      }

      const buttonsComp = tpl.componentesParsed.find(c => c.Tipo === 3);
      if (buttonsComp && buttonsComp.Botoes) {
        const possuiUrlDinamica = buttonsComp.Botoes.some(b => b.Tipo === 1 && b.Url && b.Url.includes('{{1}}'));
        if (possuiUrlDinamica) {
          this.buttonParams.set([{ value: '' }]);
        }
      }
    }
  }

  updateForm(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  updateVariavel(index: number, mudanca: Partial<VariavelBody>) {
    const lista = [...this.variaveis()];
    lista[index] = { ...lista[index], ...mudanca };
    this.variaveis.set(lista);
  }

  updateButtonParam(index: number, val: string) {
    const bp = [...this.buttonParams()];
    bp[index] = { value: val };
    this.buttonParams.set(bp);
  }

  trackByIndex(index: number): number {
    return index;
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

  // --- Navegação do passo a passo ---

  avancar() {
    const erro = this.erroDoPasso();
    if (erro) {
      this.response.set(`❌ ${erro}`);
      return;
    }
    this.response.set('');
    this.passo.update(p => Math.min(4, p + 1));
  }

  voltar() {
    this.response.set('');
    this.passo.update(p => Math.max(1, p - 1));
  }

  irParaPasso(n: number) {
    if (n > this.passo() && this.erroDoPasso()) {
      this.response.set(`❌ ${this.erroDoPasso()}`);
      return;
    }
    this.response.set('');
    this.passo.set(n);
  }

  erroDoPasso(): string | null {
    if (this.passo() === 1) {
      if (!this.form().instanciaId) return 'Escolha de qual número a mensagem vai sair.';
      if (!this.templateAtivo()) return 'Escolha o modelo de mensagem que será enviado.';
    }

    if (this.passo() === 2) {
      const semValor = this.variaveis().some(v => variavelIncompleta(v, this.parametros()));
      if (semValor) return 'Preencha o que entra em cada campo da mensagem (texto ou parâmetro).';
      if (this.temMediaHeader() && !this.headerMediaUrl().trim()) {
        return 'Cole o link da imagem ou arquivo que vai no topo da mensagem.';
      }
      if (this.buttonParams().some(bp => !bp.value.trim())) {
        return 'Preencha o valor que completa o link do botão.';
      }
    }

    if (this.passo() === 3 && this.selecionados().length === 0) {
      return 'Marque pelo menos um contato para receber a mensagem.';
    }

    return null;
  }

  // Valor do <select> de origem da variável ('fixo', campo do contato ou 'parametro:<id>').
  selecaoDaVariavel(v: VariavelBody): string {
    return selecaoDaVariavel(v);
  }

  trocarOrigem(index: number, selecao: string) {
    this.updateVariavel(index, variavelDaSelecao(selecao));
  }

  dicaDaVariavel(v: VariavelBody): string {
    return dicaDaVariavel(v, this.parametros());
  }

  // Resolve o valor de uma variável para um contato. Sem contato (prévia sem seleção),
  // devolve um exemplo visível em vez de vazio.
  private valorDaVariavel(v: VariavelBody, contato: Contato | null): string {
    return resolverValorDaVariavel(v, contato, this.parametros());
  }

  disparar() {
    const tpl = this.templateAtivo();
    const empId = this.empresaId();

    if (!tpl || !empId) {
      this.response.set('❌ Recarregue a página e tente de novo: faltou o modelo ou a sessão da empresa.');
      return;
    }

    // Repete as checagens dos passos anteriores: dá pra chegar aqui e voltar pra mexer.
    for (const p of [1, 2, 3]) {
      const anterior = this.passo();
      this.passo.set(p);
      const erro = this.erroDoPasso();
      this.passo.set(anterior);
      if (erro) {
        this.response.set(`❌ ${erro}`);
        return;
      }
    }

    const alvos = this.selecionados();
    const vars = this.variaveis();

    // Só os valores que valem pra todo mundo. Os de cada contato o backend resolve a partir de
    // "variaveis" com os dados do banco (ex: valorFatura), por CONTATO -- nunca por telefone,
    // que pode se repetir entre contatos e faria um receber os valores do outro.
    const parametrosBody = vars.map(v =>
      dependeDoContato(v, this.parametros()) ? '' : this.valorDaVariavel(v, null).trim());

    const payload = {
      idEmpresa: empId,
      empresaId: empId,
      telefones: alvos.map(c => c.telefone),
      contatosIds: alvos.map(c => c.id),
      nomeTemplate: tpl.nomeTemplate,
      idioma: tpl.idioma || 'pt_BR',
      templateId: tpl.id,
      parametroHeaderMediaUrl: this.temMediaHeader() ? this.headerMediaUrl().trim() : null,
      parametrosBody,
      variaveis: vars.map(v => ({ origem: v.origem, valorFixo: v.valorFixo, parametroId: v.parametroId ?? null })),
      parametrosButton: this.buttonParams().map(bp => bp.value.trim()),
      contatoId: '00000000-0000-0000-0000-000000000000'
    };

    this.enviando.set(true);
    this.response.set(`⏳ Enviando para ${alvos.length} contato(s)...`);
    this.errosLote.set([]);

    this.http.post<any>(`${this.API_DISPARO}/EnviarMensagemTemplateLote`, payload).subscribe({
      next: (res: any) => {
        // O endpoint retorna o envelope Response<T> cru (sem passar por ValidateResponse),
        // então o resultado real vem em res.value, não em res.data.
        const relatorioDisparos: Record<string, boolean> = res?.value?.relatorioDisparos || {};
        const relatorioErros: Record<string, string> = res?.value?.relatorioErros || {};
        const telefones = Object.keys(relatorioDisparos);
        // Totais por destinatário (o backend os conta por contato); o relatório por telefone
        // subconta quando dois contatos dividem o mesmo número.
        const total: number = res?.value?.totalProcessado ?? telefones.length;
        const sucesso: number = res?.value?.totalSucesso ?? telefones.filter(t => relatorioDisparos[t]).length;

        this.enviando.set(false);
        this.errosLote.set(Object.entries(relatorioErros).map(([telefone, erro]) => ({ telefone, erro })));

        if (total === 0) {
          this.response.set('⚠ O envio terminou, mas o servidor não informou o resultado de nenhum contato.');
        } else if (sucesso === total) {
          this.response.set(`✅ Enviado para ${sucesso} contato(s). Acompanhe as respostas em Chats.`);
        } else {
          this.response.set(`⚠ Enviado para ${sucesso} de ${total}. Os que falharam estão listados abaixo.`);
        }

        this.variaveis.set([]);
        this.buttonParams.set([]);
        this.headerMediaUrl.set('');
        this.temMediaHeader.set(false);
        this.updateForm('templateId', '');
        this.contatos.update(list => list.map(c => ({ ...c, checked: false })));
        this.passo.set(1);
      },
      error: (err) => {
        this.enviando.set(false);
        this.response.set(`❌ Falha: ${extrairMensagemErro(err, 'Erro ao enviar as mensagens.')}`);
      }
    });
  }
}
