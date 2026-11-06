import { Component, signal, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

interface CobrancaCliente {
  id: string;
  contatoId: string;
  valor: number;
  dataVencimento: string;
  status: string;
  dataPagamento?: string;
  dataCriacao: string;
  nomeCliente?: string;
  nomeContato?: string;
  telefone?: string;
  // Pix do Asaas (empresa com cobrança Pix ativa): valor com multa/juros do dia do envio.
  temPix?: boolean;
  valorCobrado?: number | null;
  pixExpiraEm?: string | null;
  linkPagamento?: string | null;
  // Baixa automática (webhook do Asaas): valor que o cliente pagou e o split dele.
  pagoViaPix?: boolean;
  valorPago?: number | null;
  valorComissao?: number | null;
  valorRepasse?: number | null;
  // Pix sem split: o valor inteiro caiu na conta da Contact Solution.
  recebidaNaPlataforma?: boolean;
  // Quem gerou o Pix: ASAAS ou MERCADOPAGO.
  provedor?: string | null;
  // A empresa tem modelo de recorrência ligado em Momentos de disparo.
  recorrenciaDisponivel?: boolean;
  // Inativa (antiga ou acertada por fora): só aparece na aba de inativas.
  ativo?: boolean;
  dataInativacao?: string | null;
}

// Uma etapa da linha do tempo da cobrança, do envio no WhatsApp até o pagamento.
interface Etapa {
  titulo: string;
  detalhe?: string;
  estado: 'feito' | 'atual' | 'falhou';
}

interface ClienteComCobrancas {
  contatoId: string;
  nome: string;
  subtitulo: string;
  cobrancas: CobrancaCliente[];
  total: number;
  recebido: number;
  emAberto: number;
  vencido: number;
}

type Situacao = 'PENDENTE' | 'VENCIDA' | 'PAGA' | 'CANCELADA';

// Cobrancas que a empresa (ex: Sebrecon) enviou aos clientes DELA via template com
// GeraCobranca. Nao confundir com /cobrancas, que e a assinatura SaaS da Contact Solution.
@Component({
  selector: 'app-cobrancas-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cobrancas-clientes.component.html',
  styleUrls: ['../shared-crud.css', './cobrancas-clientes.component.css'],
})
export class CobrancasClientesComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly API = `${environment.apiUrl}/cobranca-cliente`;

  // Os cards de total da carteira sao so do admin da empresa; atendente ve apenas a lista.
  // E so exibicao: os valores de cada cobranca continuam vindo na lista para todos.
  readonly podeVerTotais = computed(() => this.authService.ehAdminSignal() || this.authService.ehAdminDaPlataforma());

  // Tempo real: o webhook do Asaas da baixa e o servidor avisa pelo SignalR (mesmo hub do
  // Chats, autenticado; o grupo vem do token). O aviso so traz o id; os dados vem pela API.
  private hubConnection?: signalR.HubConnection;
  private recarregarTimer?: ReturnType<typeof setTimeout>;
  private pagasAvisadas = new Set<string>();
  avisoPagamento = signal('');
  destacada = signal<string | null>(null);
  linkCopiado = signal<string | null>(null);

  cobrancas = signal<CobrancaCliente[]>([]);
  carregando = signal(true);
  erro = signal('');

  // Abre no mes corrente: e o recorte que o cliente costuma conferir ("o que foi cobrado este mes").
  dataInicio = signal(this.formatarData(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  dataFim = signal(this.formatarData(new Date()));
  // Periodo que de fato esta na tela -- o input pode ter sido editado sem clicar em Filtrar.
  periodoAplicado = signal({ inicio: this.dataInicio(), fim: this.dataFim() });

  busca = signal('');
  situacao = signal<'' | Situacao>('');
  expandidos = signal<Set<string>>(new Set());
  confirmandoPagamento = signal<string | null>(null);
  dataPagamento = signal(this.formatarData(new Date()));
  hoje = this.formatarData(new Date());
  marcandoPaga = signal<string | null>(null);
  confirmandoRecorrencia = signal<string | null>(null);
  enviandoRecorrencia = signal<string | null>(null);
  // Resultado de recorrência, inativação e reativação. Não usa erro(): a tabela leria como falha
  // ao carregar a lista.
  avisoAcao = signal('');
  erroAcao = signal('');

  visualizacao = signal<'cliente' | 'cobranca'>('cliente');
  mostrandoInativas = signal(false);
  confirmandoInativacao = signal<string | null>(null);
  alterandoAtivo = signal<string | null>(null);

  // Situacao e filtrada no front (nao no endpoint) pra os cards de total continuarem mostrando
  // o periodo inteiro enquanto a tabela e recortada.
  clientes = computed<ClienteComCobrancas[]>(() => {
    const termo = this.busca().toLowerCase().trim();
    const situacao = this.situacao();
    const mapa = new Map<string, ClienteComCobrancas>();

    for (const c of this.cobrancas()) {
      if (situacao && this.situacaoDe(c) !== situacao) continue;

      let cliente = mapa.get(c.contatoId);
      if (!cliente) {
        cliente = {
          contatoId: c.contatoId,
          nome: c.nomeCliente || c.nomeContato || c.telefone || 'Contato removido',
          subtitulo: [c.nomeCliente && c.nomeContato ? c.nomeContato : '', c.telefone || ''].filter(Boolean).join(' · '),
          cobrancas: [], total: 0, recebido: 0, emAberto: 0, vencido: 0,
        };
        mapa.set(c.contatoId, cliente);
      }
      cliente.cobrancas.push(c);
      this.acumular(cliente, c);
    }

    let lista = Array.from(mapa.values());
    if (termo) {
      lista = lista.filter(cl =>
        cl.nome.toLowerCase().includes(termo) || cl.subtitulo.toLowerCase().includes(termo));
    }
    for (const cl of lista) {
      cl.cobrancas.sort((a, b) => b.dataCriacao.localeCompare(a.dataCriacao));
    }
    // Quem deve mais (vencido, depois em aberto) aparece primeiro: e o que o cliente quer ver.
    return lista.sort((a, b) => (b.vencido - a.vencido) || (b.emAberto - a.emAberto) || a.nome.localeCompare(b.nome));
  });

  // Visualização por extenso: cada cobrança numa linha, da mais recente para a mais antiga.
  cobrancasFiltradas = computed<CobrancaCliente[]>(() => {
    const termo = this.busca().toLowerCase().trim();
    const situacao = this.situacao();
    return this.cobrancas()
      .filter(c => !situacao || this.situacaoDe(c) === situacao)
      .filter(c => !termo || [c.nomeCliente, c.nomeContato, c.telefone].some(v => v?.toLowerCase().includes(termo)))
      .sort((a, b) => b.dataCriacao.localeCompare(a.dataCriacao));
  });

  resumo = computed(() => {
    const r = { qtd: 0, total: 0, recebido: 0, qtdRecebido: 0, emAberto: 0, qtdEmAberto: 0, vencido: 0, qtdVencido: 0 };
    for (const c of this.cobrancas()) {
      const s = this.situacaoDe(c);
      if (s === 'CANCELADA') continue;
      r.qtd++;
      r.total += c.valor;
      if (s === 'PAGA') { r.recebido += c.valor; r.qtdRecebido++; }
      if (s === 'PENDENTE') { r.emAberto += c.valor; r.qtdEmAberto++; }
      if (s === 'VENCIDA') { r.vencido += c.valor; r.qtdVencido++; }
    }
    return r;
  });

  ngOnInit() {
    this.buscar();
    this.conectarTempoReal();
  }

  ngOnDestroy() {
    clearTimeout(this.recarregarTimer);
    this.hubConnection?.stop();
  }

  buscar() {
    if (this.dataInicio() && this.dataFim() && this.dataInicio() > this.dataFim()) {
      this.erro.set('A data inicial não pode ser maior que a data final.');
      return;
    }

    this.carregando.set(true);
    this.erro.set('');
    this.carregarPeriodo(this.dataInicio(), this.dataFim());
  }

  private carregarPeriodo(inicio: string, fim: string, aoCarregar?: () => void) {
    let params = new HttpParams();
    if (inicio) params = params.set('dataInicio', inicio);
    if (fim) params = params.set('dataFim', fim);
    if (this.mostrandoInativas()) params = params.set('inativas', 'true');

    this.http.get<any>(this.API, { params }).subscribe({
      next: (res) => {
        // Envelope Response<T>: o resultado vem em value.
        const dados = res?.value ?? res;
        this.cobrancas.set(dados?.cobrancas ?? []);
        this.periodoAplicado.set({ inicio, fim });
        this.carregando.set(false);
        aoCarregar?.();
      },
      error: (err) => {
        this.erro.set(extrairMensagemErro(err, 'Não foi possível carregar as cobranças.'));
        this.carregando.set(false);
      }
    });
  }

  private conectarTempoReal() {
    const idEmpresa = this.authService.empresaIdSignal();
    if (!idEmpresa) return;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/chat`, { accessTokenFactory: () => this.authService.getToken() ?? '' })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('CobrancaAtualizada', (evento: { cobrancaId: string; status: string }) => {
      if (evento?.status === 'PAGA') this.pagasAvisadas.add(evento.cobrancaId);
      // Disparo em lote pago junto (ou webhook repetido) vira uma recarga so.
      clearTimeout(this.recarregarTimer);
      this.recarregarTimer = setTimeout(() => this.recarregarPorAviso(), 1200);
    });

    // Reconectou: o que foi pago enquanto a conexao caiu nao gerou aviso.
    this.hubConnection.onreconnected(() => {
      this.hubConnection?.invoke('EntrarNoGrupo', idEmpresa);
      this.recarregarPorAviso();
    });

    this.hubConnection.start()
      .then(() => this.hubConnection?.invoke('EntrarNoGrupo', idEmpresa))
      // Sem tempo real a tela continua funcionando pelo botao Atualizar.
      .catch(err => console.error('Cobranças: erro ao conectar SignalR', err));
  }

  // Recarrega o periodo que esta NA TELA (nao o que esta digitado nos filtros) e destaca o
  // pagamento que acabou de chegar.
  private recarregarPorAviso() {
    const { inicio, fim } = this.periodoAplicado();
    const pagas = Array.from(this.pagasAvisadas);
    this.pagasAvisadas.clear();

    this.carregarPeriodo(inicio, fim, () => {
      const paga = this.cobrancas().find(c => pagas.includes(c.id) && c.status === 'PAGA');
      if (!paga) return;

      const nome = paga.nomeCliente || paga.nomeContato || paga.telefone || 'cliente';
      const valor = (paga.valorPago ?? paga.valorCobrado ?? paga.valor)
        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      this.avisoPagamento.set(pagas.length > 1
        ? `💰 ${pagas.length} pagamentos recebidos via Pix, entre eles ${nome} (${valor}).`
        : `💰 Pagamento recebido via Pix: ${nome} pagou ${valor}.`);
      this.expandidos.update(atual => new Set(atual).add(paga.contatoId).add(paga.id));
      this.destacada.set(paga.id);
      setTimeout(() => { if (this.destacada() === paga.id) this.destacada.set(null); }, 8000);
    });
  }

  fecharAvisoPagamento() {
    this.avisoPagamento.set('');
  }

  // Linha do tempo: envio -> Pix gerado -> pagamento (ou expiracao).
  etapas(c: CobrancaCliente): Etapa[] {
    const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataHora = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const data = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('pt-BR');

    const etapas: Etapa[] = [{ titulo: 'Enviada no WhatsApp', detalhe: dataHora(c.dataCriacao), estado: 'feito' }];

    if (c.temPix) {
      etapas.push({
        titulo: 'Pix gerado',
        detalhe: `${moeda(c.valorCobrado ?? c.valor)}${c.pixExpiraEm ? ' · válido até ' + dataHora(c.pixExpiraEm) : ''}`,
        estado: 'feito',
      });
    }

    const situacao = this.situacaoDe(c);
    if (situacao === 'PAGA') {
      if (c.pagoViaPix) {
        const repasse = c.recebidaNaPlataforma
          ? ` · recebido na conta da Contact Solution${c.provedor === 'MERCADOPAGO' ? ' (Mercado Pago)' : ''}`
          : c.valorRepasse != null
            ? ` · ${moeda(c.valorRepasse)} na sua ${c.provedor === 'MERCADOPAGO' ? 'conta Mercado Pago' : 'subconta'}${c.valorComissao ? ' (comissão ' + moeda(c.valorComissao) + ')' : ''}`
            : '';
        etapas.push({
          titulo: 'Pago via Pix',
          detalhe: `${c.dataPagamento ? dataHora(c.dataPagamento) + ' · ' : ''}${moeda(c.valorPago ?? c.valorCobrado ?? c.valor)}${repasse}`,
          estado: 'feito',
        });
      } else {
        etapas.push({ titulo: 'Pagamento confirmado manualmente', detalhe: c.dataPagamento ? data(c.dataPagamento) : undefined, estado: 'feito' });
      }
    } else if (situacao === 'CANCELADA') {
      etapas.push({ titulo: 'Cancelada', estado: 'falhou' });
    } else if (this.pixExpirado(c)) {
      etapas.push({ titulo: 'Pix expirou sem pagamento', detalhe: c.recorrenciaDisponivel ? 'Envie a recorrência para gerar outro Pix' : 'Envie uma nova cobrança para gerar outro Pix', estado: 'falhou' });
    } else {
      etapas.push({
        titulo: c.temPix ? 'Aguardando pagamento' : 'Aguardando confirmação manual',
        detalhe: c.temPix ? 'Baixa automática quando o cliente pagar' : 'Empresa sem cobrança Pix ativa no envio',
        estado: 'atual',
      });
    }

    return etapas;
  }

  pixExpirado(c: CobrancaCliente): boolean {
    return !!c.temPix && this.emAberto(c) && !!c.pixExpiraEm && new Date(c.pixExpiraEm) < new Date();
  }

  // VENCIDA gravada (a recorrência já foi enviada) continua podendo ser paga e receber outra recorrência.
  emAberto(c: CobrancaCliente): boolean {
    const status = (c.status || '').toUpperCase();
    return status === 'PENDENTE' || status === 'VENCIDA';
  }

  copiarLink(c: CobrancaCliente) {
    if (!c.linkPagamento) return;
    navigator.clipboard?.writeText(c.linkPagamento).then(() => {
      this.linkCopiado.set(c.id);
      setTimeout(() => { if (this.linkCopiado() === c.id) this.linkCopiado.set(null); }, 2500);
    });
  }

  // Confirmacao na propria linha (sem confirm() do navegador): a mensagem vai direto ao cliente e
  // nao da para desfazer.
  enviarRecorrencia(c: CobrancaCliente) {
    this.erroAcao.set('');
    this.avisoAcao.set('');
    this.confirmandoRecorrencia.set(null);
    this.enviandoRecorrencia.set(c.id);

    const { inicio, fim } = this.periodoAplicado();
    this.http.post<any>(`${this.API}/${c.id}/enviar-recorrencia`, {}).subscribe({
      next: (res) => {
        const r = res?.value ?? res;
        const nome = c.nomeCliente || c.nomeContato || c.telefone || 'cliente';
        const valor = r?.valorCobrado != null
          ? ` Valor: ${Number(r.valorCobrado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` : '';
        const falhas = r?.totalFalhas ? ` ${r.totalFalhas} número(s) do contato não receberam.` : '';
        this.avisoAcao.set(`✅ Recorrência enviada para ${nome}. A cobrança agora consta como vencida.${r?.pixRenovado ? ' Novo Pix gerado.' : ''}${valor}${falhas}`);
        this.enviandoRecorrencia.set(null);
        // O Pix pode ter mudado (validade, valor com encargos).
        this.carregarPeriodo(inicio, fim);
      },
      error: (err) => {
        this.erroAcao.set(extrairMensagemErro(err, 'Não foi possível enviar a recorrência.'));
        this.enviandoRecorrencia.set(null);
        // A baixa pode ter sido feita no caminho (o cliente já tinha pago).
        this.carregarPeriodo(inicio, fim);
      }
    });
  }

  // A aba abre em todo o período: quem inativa costuma mexer em cobrança antiga, que o recorte do
  // mês esconderia dando a entender que ela sumiu. Na volta, retoma o mês corrente.
  alternarInativas() {
    this.mostrandoInativas.update(v => !v);
    this.confirmandoInativacao.set(null);
    this.avisoAcao.set('');
    this.erroAcao.set('');

    if (this.mostrandoInativas()) {
      this.dataInicio.set('');
      this.dataFim.set('');
    } else {
      const hoje = new Date();
      this.dataInicio.set(this.formatarData(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
      this.dataFim.set(this.formatarData(hoje));
    }
    this.buscar();
  }

  alterarAtivo(c: CobrancaCliente, ativo: boolean) {
    this.confirmandoInativacao.set(null);
    this.avisoAcao.set('');
    this.erroAcao.set('');
    this.alterandoAtivo.set(c.id);

    const { inicio, fim } = this.periodoAplicado();
    const nome = c.nomeCliente || c.nomeContato || c.telefone || 'cliente';
    this.http.patch<any>(`${this.API}/${c.id}/ativo`, { ativo }).subscribe({
      next: () => {
        this.avisoAcao.set(ativo ? `✅ Cobrança de ${nome} reativada.` : `✅ Cobrança de ${nome} inativada. Ela continua guardada em "Ver inativas".`);
        this.alterandoAtivo.set(null);
        this.carregarPeriodo(inicio, fim);
      },
      error: (err) => {
        this.erroAcao.set(extrairMensagemErro(err, 'Não foi possível alterar a cobrança.'));
        this.alterandoAtivo.set(null);
        // A baixa pode ter sido feita no caminho (o cliente já tinha pago).
        this.carregarPeriodo(inicio, fim);
      }
    });
  }

  aplicarAtalho(atalho: 'mes' | 'mesAnterior' | '30' | '90') {
    const hoje = new Date();
    let inicio: Date;
    let fim = hoje;
    switch (atalho) {
      case 'mes': inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1); break;
      case 'mesAnterior':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        break;
      case '30': inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 29); break;
      case '90': inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 89); break;
    }
    this.dataInicio.set(this.formatarData(inicio));
    this.dataFim.set(this.formatarData(fim));
    this.buscar();
  }

  limparFiltroData() {
    this.dataInicio.set('');
    this.dataFim.set('');
    this.buscar();
  }

  alternar(contatoId: string) {
    this.expandidos.update(atual => {
      const novo = new Set(atual);
      novo.has(contatoId) ? novo.delete(contatoId) : novo.add(contatoId);
      return novo;
    });
  }

  estaExpandido(contatoId: string): boolean {
    return this.expandidos().has(contatoId) || !!this.busca().trim();
  }

  // Primeiro clique abre a confirmacao com a data do pagamento (sem confirm() do navegador):
  // marcar paga nao tem desfazer na tela, e quem confere o extrato marca com atraso -- a data
  // real do Pix importa mais que a data do clique.
  iniciarConfirmacao(c: CobrancaCliente) {
    this.dataPagamento.set(this.formatarData(new Date()));
    this.confirmandoPagamento.set(c.id);
  }

  cancelarConfirmacao() {
    this.confirmandoPagamento.set(null);
  }

  marcarPaga(c: CobrancaCliente) {
    const data = this.dataPagamento();
    if (!data || data > this.formatarData(new Date())) {
      this.erro.set('Informe a data do pagamento (não pode ser no futuro).');
      return;
    }

    this.erro.set('');
    this.confirmandoPagamento.set(null);
    this.marcandoPaga.set(c.id);
    this.http.patch<any>(`${this.API}/${c.id}/marcar-paga`, { dataPagamento: data }).subscribe({
      next: (res) => {
        // "yyyy-MM-dd" puro o DatePipe le como UTC e mostraria o dia anterior (UTC-3).
        const dataGravada = res?.value?.dataPagamento ?? `${data}T00:00:00`;
        this.cobrancas.update(lista => lista.map(x =>
          x.id === c.id ? { ...x, status: 'PAGA', dataPagamento: dataGravada } : x));
        this.marcandoPaga.set(null);
      },
      error: (err) => {
        this.erro.set(extrairMensagemErro(err, 'Não foi possível marcar a cobrança como paga.'));
        this.marcandoPaga.set(null);
      }
    });
  }

  // VENCIDA e gravada pelo envio de recorrencia ou, sem ele, PENDENTE com vencimento antes de hoje
  // (mesma regra do filtro status=VENCIDA do backend).
  situacaoDe(c: CobrancaCliente): Situacao {
    const status = (c.status || '').toUpperCase();
    if (status === 'PENDENTE' && c.dataVencimento.substring(0, 10) < this.formatarData(new Date())) {
      return 'VENCIDA';
    }
    return status as Situacao;
  }

  rotuloSituacao(c: CobrancaCliente): string {
    switch (this.situacaoDe(c)) {
      case 'PENDENTE': return 'Em aberto';
      case 'VENCIDA': return 'Vencida';
      case 'PAGA': return 'Paga';
      case 'CANCELADA': return 'Cancelada';
      default: return c.status;
    }
  }

  classeSituacao(c: CobrancaCliente): string {
    switch (this.situacaoDe(c)) {
      case 'PAGA': return 'badge-green';
      case 'PENDENTE': return 'badge-blue';
      case 'VENCIDA': return 'badge-danger';
      default: return 'badge-muted';
    }
  }

  descricaoPeriodo(): string {
    const { inicio, fim } = this.periodoAplicado();
    const br = (d: string) => d.split('-').reverse().join('/');
    if (inicio && fim) return `de ${br(inicio)} até ${br(fim)}`;
    if (inicio) return `a partir de ${br(inicio)}`;
    if (fim) return `até ${br(fim)}`;
    return 'em todo o período';
  }

  private acumular(cliente: ClienteComCobrancas, c: CobrancaCliente) {
    const s = this.situacaoDe(c);
    if (s === 'CANCELADA') return;
    cliente.total += c.valor;
    if (s === 'PAGA') cliente.recebido += c.valor;
    if (s === 'PENDENTE') cliente.emAberto += c.valor;
    if (s === 'VENCIDA') cliente.vencido += c.valor;
  }

  // yyyy-MM-dd no fuso local -- toISOString() jogaria pro dia seguinte a noite (UTC-3).
  private formatarData(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
}
