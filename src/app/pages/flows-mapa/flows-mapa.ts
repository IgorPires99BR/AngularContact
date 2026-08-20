import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import ForceGraph3D, { ForceGraph3DInstance } from '3d-force-graph';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { NumeroSelectorComponent } from '../../shared/numero-selector/numero-selector';

interface Template {
  id: string;
  empresaId: string;
  nomeTemplate: string;
  conteudo: string;
  categoria: string;
  idioma: string;
  status: string;
}

interface FlowEtapa {
  id: string;
  nomeEtapa: string;
  conteudoLivre: string;
  gatilhoResposta: string;
  proximaEtapaId: string | null;
  ehEtapaInicial: boolean;
  templateId: string | null;
  variavelSaida: string | null;
  botao1: string | null;
  botao2: string | null;
  proximaEtapaIdB: string | null;
}

// Um "passo" da versão legível do flow: a etapa em si, mais os caminhos de saída já
// resolvidos pro nome da etapa de destino, pra montar frases tipo "se clicar em X, vai
// para Y" sem o dono da empresa precisar entender IDs.
interface PassoLegivel {
  numero: number;
  etapa: FlowEtapa;
  destinoPrincipalNome: string | null;
  destinoBotao1Nome: string | null;
  destinoBotao2Nome: string | null;
  terminal: boolean;
}

interface Flow {
  id: string;
  idEmpresa: string;
  nome: string;
  descricao: string;
  gatilhoPalavraChave: string;
  ativo: boolean;
  numeroId: string | null;
  etapas: FlowEtapa[];
}

interface GraphNode {
  id: string;
  name: string;
  tipoStep: string;
  conteudo: string;
  ehEtapaInicial: boolean;
  templateNome?: string;
  color: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
}

@Component({
  selector: 'app-flows-mapa',
  standalone: true,
  imports: [CommonModule, NumeroSelectorComponent],
  templateUrl: './flows-mapa.html',
  styleUrls: ['../shared-crud.css', './flows-mapa.css']
})
export class FlowsMapaComponent implements OnInit, AfterViewInit {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);

  private readonly FLOW_API_URL = `${environment.apiUrl}/config/flow`;
  private readonly TEMPLATE_API_URL = `${environment.apiUrl}/template`;
  private empresaId = this.authService.empresaIdSignal;

  private grafo?: ForceGraph3DInstance;

  flows = signal<Flow[]>([]);
  templates = signal<Template[]>([]);
  flowSelecionadoId = signal<string>('');
  numeroFiltro = signal<string>('');

  // Sempre inclui os flows genericos (numeroId nulo) alem dos especificos do numero
  // filtrado -- mesma regra de prioridade/visibilidade usada no backend (FlowOrchestratorService).
  flowsFiltrados = computed(() => {
    const filtro = this.numeroFiltro();
    if (!filtro) return this.flows();
    return this.flows().filter(f => f.numeroId === filtro || f.numeroId === null);
  });

  flowSelecionado = computed(() => this.flowsFiltrados().find(f => f.id === this.flowSelecionadoId()) ?? this.flowsFiltrados()[0]);

  etapaSelecionada = signal<GraphNode | null>(null);
  mensagem = signal('');
  carregando = signal(true);

  // Seção escondida com a versão em texto do flow selecionado, pro dono da empresa
  // entender o processo sem precisar interpretar o grafo 3D.
  detalhesAbertos = signal(false);

  // Segue a corrente a partir da etapa inicial pelo caminho principal (proximaEtapaId),
  // igual ordenarPelaCorrente() do flow-builder -- mantém a leitura na mesma ordem em que
  // a conversa realmente acontece, mesmo sem coluna "Ordem" persistida no banco.
  passosLegiveis = computed<PassoLegivel[]>(() => {
    const etapas = this.flowSelecionado()?.etapas ?? [];
    if (etapas.length === 0) return [];

    const porId = new Map(etapas.map(e => [e.id, e]));
    const nomePorId = (id: string | null) => id ? (porId.get(id)?.nomeEtapa ?? '(etapa removida)') : null;

    const inicial = etapas.find(e => e.ehEtapaInicial) ?? etapas[0];
    const ordenadas: FlowEtapa[] = [];
    const visitadas = new Set<string>();

    let atual: FlowEtapa | undefined = inicial;
    while (atual && !visitadas.has(atual.id)) {
      visitadas.add(atual.id);
      ordenadas.push(atual);
      atual = atual.proximaEtapaId ? porId.get(atual.proximaEtapaId) : undefined;
    }
    for (const etapa of etapas) {
      if (!visitadas.has(etapa.id)) ordenadas.push(etapa);
    }

    return ordenadas.map((etapa, index) => ({
      numero: index + 1,
      etapa,
      destinoPrincipalNome: nomePorId(etapa.proximaEtapaId),
      destinoBotao1Nome: etapa.botao1 ? nomePorId(etapa.proximaEtapaId) : null,
      destinoBotao2Nome: etapa.botao2 ? nomePorId(etapa.proximaEtapaIdB) : null,
      terminal: !etapa.proximaEtapaId && !etapa.proximaEtapaIdB
    }));
  });

  ngOnInit() {
    this.carregarDados();
  }

  ngAfterViewInit() {
    const Fabrica: any = ForceGraph3D;
    this.grafo = new Fabrica()(this.graphContainer.nativeElement)
      .nodeLabel((node: any) => node.templateNome
        ? `🎯 Início — Template: ${node.templateNome}`
        : `${node.name}`)
      .nodeColor((node: any) => node.color)
      .nodeVal((node: any) => node.val)
      .linkDirectionalArrowLength(6)
      .linkDirectionalArrowRelPos(1)
      .linkDirectionalParticles(2)
      .linkDirectionalParticleWidth(2)
      .enableNodeDrag(true)
      .backgroundColor('rgba(0,0,0,0)')
      .onNodeClick((node: any) => this.aoClicarNo(node));

    const el = this.graphContainer.nativeElement;
    this.grafo?.width(el.clientWidth || 800);
    this.grafo?.height(el.clientHeight || 600);
  }

  voltar() {
    this.router.navigate(['/flows']);
  }

  selecionarFlow(id: string) {
    this.flowSelecionadoId.set(id);
    this.etapaSelecionada.set(null);
    this.atualizarGrafo();
  }

  onNumeroFiltroChange(numeroId: string) {
    this.numeroFiltro.set(numeroId);
    const filtrados = this.flowsFiltrados();
    this.flowSelecionadoId.set(filtrados[0]?.id ?? '');
    this.etapaSelecionada.set(null);
    this.atualizarGrafo();
  }

  private carregarDados() {
    this.carregando.set(true);
    const empId = this.empresaId();
    if (!empId) {
      this.carregando.set(false);
      return;
    }

    // GET /config/flow/{id} devolve o array puro, sem envelope { value: [...] } (ver nota
    // em flows.component.ts).
    this.http.get<any[]>(`${this.FLOW_API_URL}/${empId}`).subscribe({
      next: (res) => {
        const lista = Array.isArray(res) ? res : [];
        const mapeados: Flow[] = lista.map(f => this.mapearFlow(f));
        this.flows.set(mapeados);
        if (mapeados.length > 0) {
          this.flowSelecionadoId.set(mapeados[0].id);
        }
        this.carregarTemplates();
      },
      error: () => {
        this.mensagem.set('❌ Erro ao carregar fluxos.');
        this.carregando.set(false);
      }
    });
  }

  private mapearFlow(f: any): Flow {
    const etapasRaw = f.etapas || f.Etapas || [];
    const etapas: FlowEtapa[] = etapasRaw.map((e: any) => ({
      id: e.id || e.Id,
      nomeEtapa: e.nomeEtapa || e.NomeEtapa || e.tipoStep || e.TipoStep,
      conteudoLivre: e.conteudoLivre || e.ConteudoLivre || e.mensagemPergunta || e.MensagemPergunta || '',
      gatilhoResposta: e.gatilhoResposta || e.GatilhoResposta || '',
      proximaEtapaId: e.proximaEtapaId || e.ProximaEtapaId || null,
      ehEtapaInicial: e.ehEtapaInicial !== undefined ? e.ehEtapaInicial : e.EhEtapaInicial,
      templateId: e.templateId || e.TemplateId || null,
      variavelSaida: e.variavelSaida || e.VariavelSaida || null,
      botao1: e.botao1 || e.Botao1 || null,
      botao2: e.botao2 || e.Botao2 || null,
      proximaEtapaIdB: e.proximaEtapaIdB || e.ProximaEtapaIdB || null
    }));

    return {
      id: f.id || f.Id,
      idEmpresa: f.idEmpresa || f.IdEmpresa || f.empresaId || f.EmpresaId,
      nome: f.nome || f.Nome,
      descricao: f.descricao || f.Descricao || '',
      gatilhoPalavraChave: f.gatilhoPalavraChave || f.GatilhoPalavraChave || '',
      ativo: f.ativo !== undefined ? f.ativo : f.Ativo,
      numeroId: f.numeroId || f.NumeroId || null,
      etapas
    };
  }

  private carregarTemplates() {
    const empId = this.empresaId();
    if (!empId) {
      this.carregando.set(false);
      this.atualizarGrafo();
      return;
    }

    this.http.get<Template[]>(`${this.TEMPLATE_API_URL}/Listar/${empId}`).subscribe({
      next: (templates) => {
        this.templates.set(templates || []);
        this.carregando.set(false);
        this.atualizarGrafo();
      },
      error: () => {
        this.templates.set([]);
        this.carregando.set(false);
        this.atualizarGrafo();
      }
    });
  }

  private nomeTemplate(templateId: string | null): string | undefined {
    if (!templateId) return undefined;
    return this.templates().find(t => t.id === templateId)?.nomeTemplate;
  }

  private corPorEtapa(etapa: FlowEtapa): string {
    if (etapa.ehEtapaInicial) return '#3b82f6'; // azul brilhante
    const tipo = (etapa.nomeEtapa || '').toLowerCase();
    if (tipo.includes('encerrar')) return '#2ecc71'; // verde
    return '#8e6ff7'; // roxo/cinza
  }

  private atualizarGrafo() {
    const flow = this.flowSelecionado();
    if (!flow) {
      this.grafo?.graphData({ nodes: [], links: [] });
      return;
    }

    const nodes: GraphNode[] = flow.etapas.map(e => ({
      id: e.id,
      name: e.nomeEtapa,
      tipoStep: e.nomeEtapa,
      conteudo: e.conteudoLivre,
      ehEtapaInicial: e.ehEtapaInicial,
      templateNome: e.ehEtapaInicial ? this.nomeTemplate(e.templateId) : undefined,
      color: this.corPorEtapa(e),
      val: e.ehEtapaInicial ? 8 : 4
    }));

    const links: GraphLink[] = flow.etapas
      .filter(e => e.proximaEtapaId)
      .map(e => ({ source: e.id, target: e.proximaEtapaId as string }));

    if (this.grafo) {
      this.grafo.graphData({ nodes, links });
    }
  }

  private aoClicarNo(node: any) {
    this.etapaSelecionada.set(node);
  }

  fecharPainel() {
    this.etapaSelecionada.set(null);
  }

  alternarDetalhes() {
    this.detalhesAbertos.update(v => !v);
  }

  fecharDetalhes() {
    this.detalhesAbertos.set(false);
  }
}
