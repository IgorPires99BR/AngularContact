import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';
import { NumeroSelectorComponent } from '../../shared/numero-selector/numero-selector';

export interface Flow {
  id: string;
  idEmpresa: string;
  nome: string;
  descricao: string;
  gatilhoPalavraChave: string;
  ativo: boolean;
  numeroId: string | null;
  totalEtapas: number;
}

export interface FunilEtapa {
  etapaId: string;
  ordem: number;
  nomeEtapa: string;
  rotulo: string | null;
  ehEtapaFinal: boolean;
  presas: number;
  entreguesAoAtendente: number;
  concluiram: number;
}

export interface Funil {
  flowId: string;
  nomeFlow: string;
  totalConversas: number;
  totalConcluiram: number;
  totalEntreguesAoAtendente: number;
  totalPresas: number;
  etapas: FunilEtapa[];
}

// Lista de Flows da empresa, com filtro por número. A criação/edição virou uma tela
// própria (/flows/novo, /flows/:id/editar) — antes tudo (lista + builder + monitor)
// vivia num único componente com abas, o que ficava confuso conforme os flows cresciam.
@Component({
  selector: 'app-flows',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NumeroSelectorComponent],
  templateUrl: './flows.component.html',
  styleUrls: ['../shared-crud.css', './flows.component.css'],
})
export class FlowsComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);

  private readonly API_URL = `${environment.apiUrl}/config/flow`;
  private readonly FUNIL_URL = `${environment.apiUrl}/relatorio/funil-flow`;
  private idEmpresaLogada = this.authService.empresaIdSignal;

  response = signal('');
  carregando = signal(true);
  flows = signal<Flow[]>([]);
  numeroFiltro = signal<string>('');
  busca = signal('');

  // Em qual etapa as conversas param -- ate agora nao existia nenhuma forma de ver isso.
  // Expande sob o proprio flow em vez de abrir uma tela separada: e um numero que so faz
  // sentido junto do flow que ele descreve.
  funilAberto = signal<string | null>(null);
  funil = signal<Funil | null>(null);
  carregandoFunil = signal(false);
  erroFunil = signal('');

  ativos = computed(() => this.flows().filter(f => f.ativo).length);
  inativos = computed(() => this.flows().filter(f => !f.ativo).length);

  flowsFiltrados = computed(() => {
    const termo = this.busca().toLowerCase().trim();
    if (!termo) return this.flows();
    return this.flows().filter(f =>
      f.nome?.toLowerCase().includes(termo) ||
      f.gatilhoPalavraChave?.toLowerCase().includes(termo)
    );
  });

  ngOnInit() {
    this.buscar();
  }

  onNumeroFiltroChange(numeroId: string) {
    this.numeroFiltro.set(numeroId);
    this.buscar();
  }

  buscar() {
    const empId = this.idEmpresaLogada();
    if (!empId) return;

    this.carregando.set(true);
    const numeroId = this.numeroFiltro();
    const url = numeroId ? `${this.API_URL}/${empId}?numeroId=${numeroId}` : `${this.API_URL}/${empId}`;

    // GET /config/flow/{id} devolve o array puro, sem envelope { value: [...] } (diferente
    // de outros endpoints da API) -- ValidateResponse<T> so embrulha quando o controller
    // passa statusCode 0; FlowsController passa 200 explicito, entao vem cru.
    this.http.get<any[]>(url).subscribe({
      next: (res) => {
        const lista = Array.isArray(res) ? res : [];
        const mapeados: Flow[] = lista.map(f => ({
          id: f.id || f.Id,
          idEmpresa: f.idEmpresa || f.IdEmpresa || f.empresaId || f.EmpresaId,
          nome: f.nome || f.Nome,
          descricao: f.descricao || f.Descricao,
          gatilhoPalavraChave: f.gatilhoPalavraChave || f.GatilhoPalavraChave || '',
          ativo: f.ativo !== undefined ? f.ativo : f.Ativo,
          numeroId: f.numeroId || f.NumeroId || null,
          totalEtapas: (f.etapas || f.Etapas || []).length
        }));
        this.flows.set(mapeados);
        this.carregando.set(false);
      },
      error: (err) => {
        this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao carregar fluxos do servidor para esta empresa.')}`);
        this.carregando.set(false);
      }
    });
  }

  toggleFunil(flowId: string) {
    if (this.funilAberto() === flowId) {
      this.funilAberto.set(null);
      return;
    }

    this.funilAberto.set(flowId);
    this.funil.set(null);
    this.erroFunil.set('');
    this.carregandoFunil.set(true);

    this.http.get<any>(`${this.FUNIL_URL}/${flowId}`).subscribe({
      next: (res) => {
        const d = res?.value ?? res;
        this.funil.set(d as Funil);
        this.carregandoFunil.set(false);
      },
      error: (err) => {
        this.erroFunil.set(extrairMensagemErro(err, 'Não foi possível carregar o funil deste flow.'));
        this.carregandoFunil.set(false);
      }
    });
  }

  // Maior valor entre as etapas, pra escalar as barras -- sem isso uma etapa com 2 pessoas e
  // outra com 20 ficariam do mesmo tamanho visual, escondendo a queda que o funil existe pra
  // mostrar.
  maiorTotalEtapa(f: Funil): number {
    return Math.max(1, ...f.etapas.map(e => this.totalEtapa(e)));
  }

  totalEtapa(e: FunilEtapa): number {
    return e.presas + e.entreguesAoAtendente + e.concluiram;
  }

  novoFlow() {
    const numeroId = this.numeroFiltro();
    this.router.navigate(['/flows/novo'], numeroId ? { queryParams: { numeroId } } : {});
  }

  editar(id: string) {
    this.router.navigate(['/flows', id, 'editar']);
  }

  excluir(id: string) {
    if (!confirm('Deseja realmente remover este fluxo de conversa? Isso apagará todas as etapas vinculadas.')) return;

    this.response.set('⏳ Removendo fluxo...');
    this.http.delete(`${this.API_URL}/${id}`).subscribe({
      next: () => {
        this.flows.update(list => list.filter(f => f.id !== id));
        this.response.set('✅ Fluxo removido com sucesso.');
      },
      error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao tentar excluir o fluxo do servidor.')}`)
    });
  }

  badgeClass(ativo: boolean) {
    return ativo ? 'badge-green' : 'badge-muted';
  }

  statusLabel(ativo: boolean) {
    return ativo ? 'Ativo' : 'Inativo';
  }

  numeroLabel(numeroId: string | null) {
    return numeroId ? 'Número específico' : 'Todos os números';
  }
}
