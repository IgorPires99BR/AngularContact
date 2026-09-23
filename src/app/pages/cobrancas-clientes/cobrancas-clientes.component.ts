import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
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
export class CobrancasClientesComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/cobranca-cliente`;

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
  marcandoPaga = signal<string | null>(null);

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
  }

  buscar() {
    if (this.dataInicio() && this.dataFim() && this.dataInicio() > this.dataFim()) {
      this.erro.set('A data inicial não pode ser maior que a data final.');
      return;
    }

    this.carregando.set(true);
    this.erro.set('');

    let params = new HttpParams();
    if (this.dataInicio()) params = params.set('dataInicio', this.dataInicio());
    if (this.dataFim()) params = params.set('dataFim', this.dataFim());

    this.http.get<any>(this.API, { params }).subscribe({
      next: (res) => {
        // Envelope Response<T>: o resultado vem em value.
        const dados = res?.value ?? res;
        this.cobrancas.set(dados?.cobrancas ?? []);
        this.periodoAplicado.set({ inicio: this.dataInicio(), fim: this.dataFim() });
        this.carregando.set(false);
      },
      error: (err) => {
        this.erro.set(extrairMensagemErro(err, 'Não foi possível carregar as cobranças.'));
        this.carregando.set(false);
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

  // Confirmacao em dois cliques (sem confirm() do navegador): marcar paga nao tem desfazer na tela.
  marcarPaga(c: CobrancaCliente) {
    if (this.confirmandoPagamento() !== c.id) {
      this.confirmandoPagamento.set(c.id);
      return;
    }

    this.confirmandoPagamento.set(null);
    this.marcandoPaga.set(c.id);
    this.http.patch<any>(`${this.API}/${c.id}/marcar-paga`, {}).subscribe({
      next: () => {
        this.cobrancas.update(lista => lista.map(x =>
          x.id === c.id ? { ...x, status: 'PAGA', dataPagamento: new Date().toISOString() } : x));
        this.marcandoPaga.set(null);
      },
      error: (err) => {
        this.erro.set(extrairMensagemErro(err, 'Não foi possível marcar a cobrança como paga.'));
        this.marcandoPaga.set(null);
      }
    });
  }

  // VENCIDA nao e gravada no banco: e PENDENTE com vencimento antes de hoje (mesma regra do
  // filtro status=VENCIDA do backend).
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
