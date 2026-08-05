import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, inject, signal } from '@angular/core';
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

interface TemplateConexao {
  id: string;
  empresaId: string;
  templateOrigemId: string;
  templateDestinoId: string;
  botaoTexto?: string;
}

interface GraphNode {
  id: string;
  name: string;
  categoria: string;
  status: string;
  color: string;
}

interface GraphLink {
  source: string;
  target: string;
  botaoTexto?: string;
}

@Component({
  selector: 'app-templates-mapa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './templates-mapa.html',
  styleUrls: ['../shared-crud.css', './templates-mapa.css']
})
export class TemplatesMapaComponent implements OnInit, AfterViewInit {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);

  private readonly API_URL = `${environment.apiUrl}/template`;
  private empresaId = this.authService.empresaIdSignal;

  private grafo?: ForceGraph3DInstance;
  private templates: Template[] = [];
  private conexoes: TemplateConexao[] = [];

  modoConectar = signal(false);
  private noSelecionadoParaConexao: string | null = null;

  templateSelecionado = signal<Template | null>(null);
  mensagem = signal('');
  carregando = signal(true);

  ngOnInit() {
    this.carregarDados();
  }

  ngAfterViewInit() {
    const Fabrica: any = ForceGraph3D;
    this.grafo = new Fabrica()(this.graphContainer.nativeElement)
      .nodeLabel((node: any) => `${node.name} (${node.status})`)
      .nodeColor((node: any) => node.color)
      .nodeVal(4)
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
    this.router.navigate(['/templates']);
  }

  toggleModoConectar() {
    this.modoConectar.update(v => !v);
    this.noSelecionadoParaConexao = null;
    if (this.modoConectar()) {
      this.mensagem.set('Modo conectar ativo: clique em 2 templates em sequência para ligá-los.');
    } else {
      this.mensagem.set('');
    }
  }

  private carregarDados() {
    this.carregando.set(true);
    const empId = this.empresaId();
    if (!empId) {
      this.carregando.set(false);
      return;
    }

    this.http.get<Template[]>(`${this.API_URL}/Listar/${empId}`).subscribe({
      next: (templates) => {
        this.templates = templates || [];
        this.carregarConexoes();
      },
      error: () => {
        this.mensagem.set('❌ Erro ao carregar templates.');
        this.carregando.set(false);
      }
    });
  }

  private carregarConexoes() {
    const empId = this.empresaId();
    if (!empId) {
      this.carregando.set(false);
      return;
    }

    this.http.get<TemplateConexao[]>(`${this.API_URL}/conexoes/${empId}`).subscribe({
      next: (conexoes) => {
        this.conexoes = conexoes || [];
        this.atualizarGrafo();
        this.carregando.set(false);
      },
      error: () => {
        this.conexoes = [];
        this.atualizarGrafo();
        this.carregando.set(false);
      }
    });
  }

  private corPorStatus(status: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED' || s === 'APPROVED_META') return '#2ecc71';
    if (s === 'PENDING') return '#f1c40f';
    return '#e74c3c';
  }

  private atualizarGrafo() {
    const nodes: GraphNode[] = this.templates.map(t => ({
      id: t.id,
      name: t.nomeTemplate,
      categoria: t.categoria,
      status: t.status,
      color: this.corPorStatus(t.status)
    }));

    const links: GraphLink[] = this.conexoes.map(c => ({
      source: c.templateOrigemId,
      target: c.templateDestinoId,
      botaoTexto: c.botaoTexto
    }));

    if (this.grafo) {
      this.grafo.graphData({ nodes, links });
    }
  }

  private aoClicarNo(node: any) {
    if (this.modoConectar()) {
      if (!this.noSelecionadoParaConexao) {
        this.noSelecionadoParaConexao = node.id;
        this.mensagem.set(`Origem selecionada: ${node.name}. Clique no destino.`);
        return;
      }

      if (this.noSelecionadoParaConexao === node.id) {
        this.mensagem.set('Selecione um template diferente como destino.');
        return;
      }

      this.criarConexao(this.noSelecionadoParaConexao, node.id);
      this.noSelecionadoParaConexao = null;
      return;
    }

    const template = this.templates.find(t => t.id === node.id) || null;
    this.templateSelecionado.set(template);
  }

  private criarConexao(origemId: string, destinoId: string) {
    const empId = this.empresaId();
    if (!empId) return;

    const payload = {
      empresaId: empId,
      templateOrigemId: origemId,
      templateDestinoId: destinoId
    };

    this.mensagem.set('⏳ Criando conexão...');

    this.http.post(`${this.API_URL}/conexoes`, payload).subscribe({
      next: () => {
        this.mensagem.set('✅ Conexão criada com sucesso.');
        this.carregarConexoes();
      },
      error: () => {
        this.mensagem.set('❌ Erro ao criar conexão.');
      }
    });
  }

  fecharPainel() {
    this.templateSelecionado.set(null);
  }
}
