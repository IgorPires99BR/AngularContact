import { ProvedorCobrancaService, camposComProvedor } from '../../shared/variaveis/provedor-cobranca.service';
import { Component, signal, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';
import { TemplateService } from '../templates/template.service';
import { Template, TemplateComponente, parseComponentes, nomeDoTemplate } from '../templates/template.models';
import { AssistenteIaBotaoComponent } from '../../shared/assistente-ia/assistente-ia-botao';
import { ParametroService } from '../parametros/parametro.service';
import {
  ParametroEmpresa, VariavelTemplate, dependeDoContato, dicaDaVariavel,
  selecaoDaVariavel, valorDaVariavel as resolverValorDaVariavel, variavelDaSelecao, variavelIncompleta
} from '../../shared/variaveis/variavel-template';

interface Contato {
  id: string;
  nomeContato?: string;
  telefone: string;
  telefone2?: string | null;
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

interface PendenciaLote {
  contatoId: string;
  nome?: string | null;
  telefone?: string | null;
  status: 'FALHOU' | 'INCERTO' | 'ENVIADO';
  erro?: string | null;
}

interface LoteDisparo {
  id: string;
  dataCriacao: string;
  nomeTemplate?: string | null;
  total: number;
  aguardando: number;
  enviados: number;
  falhas: number;
  incertos: number;
  concluido: boolean;
  pendencias: PendenciaLote[];
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
export class DisparadorComponent implements OnInit, OnDestroy {
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
  // Data do último template enviado a cada contato (contatoId -> data).
  private ultimosDisparos = signal<Record<string, string>>({});
  templates = signal<TemplateMeta[]>([]);
  readonly nomeDoTemplate = nomeDoTemplate;
  numerosAtivos = signal<NumeroMeta[]>([]);
  search = signal('');

  form = signal({
    templateId: '',
    instanciaId: '',
  });

  variaveis = signal<VariavelBody[]>([]);
  // Parâmetros cadastrados da empresa (tela Parâmetros), oferecidos como origem de cada variável.
  parametros = signal<ParametroEmpresa[]>([]);
  // Adquirente da empresa entre parênteses nas variáveis de Pix.
  private provedorCobranca = inject(ProvedorCobrancaService).provedorDa(this.empresaId);
  readonly camposDoContato = computed(() => camposComProvedor(this.provedorCobranca()));
  buttonParams = signal<{ value: string }[]>([]);
  headerMediaUrl = signal('');
  temMediaHeader = signal(false);
  // Cabeçalho de imagem em template de cobrança: em branco, a API coloca o QR code do Pix.
  cabecalhoOpcional = signal(false);
  response = signal('');
  explicacaoTemplate = signal('');

  // O envio roda na fila do servidor: dá para sair da tela e voltar sem perder nada.
  loteAtual = signal<LoteDisparo | null>(null);
  lotesRecentes = signal<LoteDisparo[]>([]);
  percentualLote = computed(() => {
    const l = this.loteAtual();
    return l && l.total > 0 ? Math.round(((l.total - l.aguardando) / l.total) * 100) : 0;
  });
  private timerLote?: ReturnType<typeof setTimeout>;
  // Mesma chave enquanto o pedido for o mesmo: repetir depois de uma falha de rede não cria outro
  // lote (o primeiro pode ter sido aceito sem a resposta chegar aqui).
  private pedidoSemResposta: { assinatura: string; chave: string } | null = null;

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
      (c.nomeCliente && c.nomeCliente.toLowerCase().includes(termo)) ||
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
    this.buscarUltimosDisparos();
    this.buscarLotesRecentes(true);
  }

  ngOnDestroy() {
    clearTimeout(this.timerLote);
  }

  buscarLotesRecentes(retomar = false) {
    const empId = this.empresaId();
    if (!empId) return;
    this.http.get<{ lotes: LoteDisparo[] }>(`${this.API_DISPARO}/lotes/recentes/${empId}`).subscribe({
      next: (res) => {
        this.lotesRecentes.set(res?.lotes ?? []);
        const emAndamento = this.lotesRecentes().find(l => !l.concluido);
        if (retomar && emAndamento) this.acompanharLote(emAndamento.id);
      },
      // A lista é só atalho; sem ela o envio continua funcionando.
      error: () => this.lotesRecentes.set([])
    });
  }

  acompanharLote(id: string) {
    clearTimeout(this.timerLote);
    this.http.get<{ lotes: LoteDisparo[] }>(`${this.API_DISPARO}/lotes/${id}`).subscribe({
      next: (res) => {
        const lote = res?.lotes?.[0] ?? null;
        this.loteAtual.set(lote);
        if (lote && !lote.concluido) {
          this.timerLote = setTimeout(() => this.acompanharLote(id), 3000);
        } else {
          this.buscarUltimosDisparos();
          this.buscarLotesRecentes();
        }
      },
      // Falha aqui é só da consulta: o envio segue no servidor, então continua perguntando.
      error: () => { this.timerLote = setTimeout(() => this.acompanharLote(id), 10000); }
    });
  }

  fecharLote() {
    clearTimeout(this.timerLote);
    this.loteAtual.set(null);
  }

  buscarUltimosDisparos() {
    const empId = this.empresaId();
    if (!empId) return;
    this.http.get<{ contatoId: string; dataUltimoDisparo: string }[]>(`${this.API_DISPARO}/ultimos-disparos/${empId}`).subscribe({
      next: (res) => this.ultimosDisparos.set(Object.fromEntries(res.map(u => [u.contatoId, u.dataUltimoDisparo]))),
      // Sem a informação a coluna fica com "—"; não vale impedir o disparo por isso.
      error: () => this.ultimosDisparos.set({})
    });
  }

  ultimoDisparo(c: Contato): string | null {
    return this.ultimosDisparos()[c.id] ?? null;
  }

  // Conta dias de calendário, não 24h corridas: "ontem às 23h" é 1 dia mesmo visto à 1h da manhã.
  diasDesdeUltimoDisparo(c: Contato): number | null {
    const ultimo = this.ultimoDisparo(c);
    if (!ultimo) return null;

    const data = new Date(ultimo);
    const agora = new Date();
    const dias = Math.round(
      (new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
        - new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime()) / 86400000);
    return Math.max(0, dias);
  }

  // Abaixo de 5 dias a tela destaca: mandar de novo tão cedo costuma ser cobrança em duplicidade.
  disparoRecente(c: Contato): boolean {
    const dias = this.diasDesdeUltimoDisparo(c);
    return dias !== null && dias < 5;
  }

  rotuloDiasDesdeDisparo(c: Contato): string {
    const dias = this.diasDesdeUltimoDisparo(c);
    if (dias === null) return '';
    if (dias === 0) return 'hoje';
    return dias === 1 ? 'ontem' : `há ${dias} dias`;
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

      // Template de cobrança: o link do botão (página do Pix) é de cada contato e a API
      // preenche no envio, junto com o QR no cabeçalho de imagem deixado em branco.
      this.cabecalhoOpcional.set(!!tpl.geraCobranca && headerComp?.FormatMidia === 2);
      const buttonsComp = tpl.componentesParsed.find(c => c.Tipo === 3);
      if (buttonsComp && buttonsComp.Botoes && !tpl.geraCobranca) {
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
      if (this.temMediaHeader() && !this.cabecalhoOpcional() && !this.headerMediaUrl().trim()) {
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

    // Só diz quem recebe e de onde sai cada valor. Telefone e dados de cada contato o backend lê
    // do banco -- o front nunca informa o que cada um tem (ex: valorFatura).
    const pedido = {
      idEmpresa: empId,
      templateId: tpl.id,
      contatosIds: alvos.map(c => c.id),
      parametroHeaderMediaUrl: this.temMediaHeader() ? this.headerMediaUrl().trim() : null,
      variaveis: vars.map(v => ({ origem: v.origem, valorFixo: v.valorFixo, parametroId: v.parametroId ?? null })),
      parametrosButton: this.buttonParams().map(bp => bp.value.trim()),
    };

    const assinatura = JSON.stringify(pedido);
    if (this.pedidoSemResposta?.assinatura !== assinatura) {
      this.pedidoSemResposta = { assinatura, chave: crypto.randomUUID() };
    }

    this.enviando.set(true);
    this.response.set(`⏳ Colocando ${alvos.length} contato(s) na fila...`);

    this.http.post<{ loteId: string }>(`${this.API_DISPARO}/lotes`, { ...pedido, chaveIdempotencia: this.pedidoSemResposta.chave }).subscribe({
      next: (res) => {
        this.pedidoSemResposta = null;
        this.enviando.set(false);
        this.response.set(`✅ ${alvos.length} contato(s) na fila. O envio continua mesmo se você sair desta tela.`);

        this.variaveis.set([]);
        this.buttonParams.set([]);
        this.headerMediaUrl.set('');
        this.temMediaHeader.set(false);
        this.updateForm('templateId', '');
        this.contatos.update(list => list.map(c => ({ ...c, checked: false })));
        this.passo.set(1);
        this.buscarLotesRecentes();
        this.acompanharLote(res.loteId);
      },
      error: (err) => {
        this.enviando.set(false);
        // 4xx = recusado com certeza; o próximo pedido é outro. Sem resposta ou 5xx o lote pode ter
        // sido aceito: tentar de novo com a mesma chave devolve esse lote em vez de cobrar duas vezes.
        if (err?.status >= 400 && err?.status < 500) this.pedidoSemResposta = null;
        this.response.set(`❌ ${extrairMensagemErro(err, 'Não foi possível colocar o envio na fila.')}`);
      }
    });
  }
}
