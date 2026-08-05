import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import ForceGraph3D, { ForceGraph3DInstance } from '3d-force-graph';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

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
}

interface Flow {
  id: string;
  idEmpresa: string;
  nome: string;
  descricao: string;
  gatilhoPalavraChave: string;
  ativo: boolean;
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
  imports: [CommonModule],
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

  flowSelecionado = computed(() => this.flows().find(f => f.id === this.flowSelecionadoId()) ?? this.flows()[0]);

  etapaSelecionada = signal<GraphNode | null>(null);
  mensagem = signal('');
  carregando = signal(true);

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

  private carregarDados() {
    this.carregando.set(true);
    const empId = this.empresaId();
    if (!empId) {
      this.carregando.set(false);
      return;
    }

    this.http.get<{ value: any[] }>(`${this.FLOW_API_URL}/${empId}`).subscribe({
      next: (res) => {
        const lista = (res && Array.isArray(res.value)) ? res.value : [];
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
      templateId: e.templateId || e.TemplateId || null
    }));

    return {
      id: f.id || f.Id,
      idEmpresa: f.idEmpresa || f.IdEmpresa || f.empresaId || f.EmpresaId,
      nome: f.nome || f.Nome,
      descricao: f.descricao || f.Descricao || '',
      gatilhoPalavraChave: f.gatilhoPalavraChave || f.GatilhoPalavraChave || '',
      ativo: f.ativo !== undefined ? f.ativo : f.Ativo,
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
}
