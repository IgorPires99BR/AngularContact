import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

interface DisparoRecente {
  nome: string;
  enviadas: number;
  total: number;
  status: string;
}

interface FlowAtivo {
  nome: string;
  disparosHoje: number;
  ativo: boolean;
}

interface EvolucaoDisparo {
  data: string;
  total: number;
}

interface MetricasDashboard {
  mensagensHoje: number;
  mensagensSemana: number;
  mensagensMes: number;
  taxaEntrega: number;
  leadsCapturados: number;
  chatsAtivos: number;
  numerosAtivos: number;
  numerosPendentes: number;
  numerosBloqueados: number;
  flowsAtivos: number;
  disparosRecentes: DisparoRecente[];
  flowsComExecucoes: FlowAtivo[];
  evolucaoDisparos: EvolucaoDisparo[];
}

interface ChatAtivo {
  contatoId: string;
  nomeContato: string;
  telefone: string;
  ultimaMensagem: string;
  dataUltimaMensagem: string;
  quantidadeNaoLidas: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly API_URL = environment.apiUrl;

  carregando = signal(true);
  erro = signal('');

  metricas = signal<MetricasDashboard | null>(null);
  chats = signal<ChatAtivo[]>([]);

  kpisMain = computed(() => {
    const m = this.metricas();
    if (!m) return [];
    return [
      { icon: '📤', label: 'Msgs Enviadas (mês)', value: m.mensagensMes.toString(), delta: `${m.mensagensHoje} hoje`, deltaType: 'n' },
      { icon: '✅', label: 'Taxa de Entrega', value: `${m.taxaEntrega}%`, delta: m.taxaEntrega >= 90 ? 'Excelente' : 'Acompanhar', deltaType: m.taxaEntrega >= 90 ? 'up' : 'warn' },
      { icon: '🎯', label: 'Leads Capturados', value: m.leadsCapturados.toString(), delta: 'Últimos 30 dias', deltaType: 'n' },
      { icon: '💬', label: 'Chats Ativos', value: m.chatsAtivos.toString(), delta: 'Últimos 7 dias', deltaType: 'n' },
    ];
  });

  kpisStatus = computed(() => {
    const m = this.metricas();
    if (!m) return [];
    return [
      { icon: '📱', label: 'Números Ativos', value: m.numerosAtivos.toString(), delta: 'Operando normalmente', deltaType: 'up', tone: 'green' },
      { icon: '⏳', label: 'Números Pendentes', value: m.numerosPendentes.toString(), delta: 'Aguardando verificação', deltaType: 'n', tone: 'warn' },
      { icon: '🚫', label: 'Números Bloqueados', value: m.numerosBloqueados.toString(), delta: 'Requer atenção', deltaType: 'down', tone: 'danger' },
    ];
  });

  // Pontos do grafico de evolucao normalizados em % de altura (0-100) pro SVG
  graficoEvolucao = computed(() => {
    const m = this.metricas();
    if (!m || m.evolucaoDisparos.length === 0) return [];
    const max = Math.max(...m.evolucaoDisparos.map(d => d.total), 1);
    return m.evolucaoDisparos.map(d => ({
      ...d,
      alturaPct: Math.round((d.total / max) * 100)
    }));
  });

  ngOnInit() {
    this.carregarDados();
  }

  carregarDados() {
    const empresaId = this.authService.empresaIdSignal();
    if (!empresaId) {
      this.erro.set('Empresa não identificada.');
      this.carregando.set(false);
      return;
    }

    this.carregando.set(true);
    this.erro.set('');

    this.http.get<{ value: MetricasDashboard }>(`${this.API_URL}/dashboard/metricas/${empresaId}`)
      .subscribe({
        next: (res) => {
          this.metricas.set(res.value);
          this.carregando.set(false);
        },
        error: () => {
          this.erro.set('Não foi possível carregar as métricas do dashboard.');
          this.carregando.set(false);
        }
      });

    this.http.get<{ value: { chats: ChatAtivo[] } }>(`${this.API_URL}/chat/conversas/${empresaId}`)
      .subscribe({
        next: (res) => this.chats.set((res.value?.chats || []).slice(0, 5)),
        error: () => this.chats.set([])
      });
  }

  refresh() {
    this.carregarDados();
  }

  tempoRelativo(data: string): string {
    const diffMs = Date.now() - new Date(data).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  iniciais(nome: string): string {
    if (!nome) return '??';
    const partes = nome.trim().split(' ');
    return (partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '');
  }
}
