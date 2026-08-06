import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

interface RelatorioMensagem {
  direcao: 'Enviada' | 'Recebida';
  numeroOrigem: string;
  numeroDestino: string;
  conteudo: string;
  dataHora: string;
  status: string | null;
}

@Component({
  selector: 'app-relatorio-mensagens',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './relatorio-mensagens.component.html',
  styleUrls: ['../shared-crud.css', './relatorio-mensagens.component.css'],
})
export class RelatorioMensagensComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly API_URL = `${environment.apiUrl}/relatorio`;
  private empresaId = this.authService.empresaIdSignal;

  mensagens = signal<RelatorioMensagem[]>([]);
  carregando = signal(false);
  response = signal('');
  search = signal('');

  dataInicio = signal('');
  dataFim = signal('');

  enviadas = computed(() => this.mensagens().filter(m => m.direcao === 'Enviada').length);
  recebidas = computed(() => this.mensagens().filter(m => m.direcao === 'Recebida').length);

  mensagensFiltradas = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.mensagens();
    return this.mensagens().filter(m =>
      m.numeroOrigem?.toLowerCase().includes(termo) ||
      m.numeroDestino?.toLowerCase().includes(termo) ||
      m.conteudo?.toLowerCase().includes(termo)
    );
  });

  ngOnInit() {
    this.buscar();
  }

  buscar() {
    const empId = this.empresaId();
    if (!empId) {
      this.response.set('⚠ Empresa não identificada no sistema.');
      return;
    }

    this.carregando.set(true);
    this.response.set('');

    let params = new HttpParams().set('pagina', 0).set('tamanho', 200);
    if (this.dataInicio()) params = params.set('dataInicio', this.dataInicio());
    if (this.dataFim()) params = params.set('dataFim', this.dataFim());

    this.http.get<{ mensagens: RelatorioMensagem[] }>(`${this.API_URL}/mensagens/${empId}`, { params })
      .subscribe({
        next: (res) => {
          this.mensagens.set(res.mensagens || []);
          this.carregando.set(false);
          if ((res.mensagens || []).length === 0) {
            this.response.set('Nenhuma mensagem encontrada para o período.');
          }
        },
        error: (err) => {
          console.error(err);
          this.carregando.set(false);
          this.response.set('❌ Erro ao carregar o relatório de mensagens.');
        }
      });
  }

  limparFiltroData() {
    this.dataInicio.set('');
    this.dataFim.set('');
    this.buscar();
  }

  statusLabel(status: string | null): string {
    if (!status) return '—';
    const mapa: Record<string, string> = {
      sent: 'Enviada',
      delivered: 'Entregue',
      read: 'Lida',
      failed: 'Falhou'
    };
    return mapa[status] || status;
  }

  statusBadgeClass(status: string | null): string {
    if (!status) return 'badge-muted';
    if (status === 'read') return 'badge-blue';
    if (status === 'delivered' || status === 'sent') return 'badge-green';
    if (status === 'failed') return 'badge-danger';
    return 'badge-muted';
  }
}
