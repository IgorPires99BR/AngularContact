import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth';
import { environment } from '../../../environments/environment';

interface ChatResumo {
  quantidadeNaoLidas: number;
}

/**
 * Fonte única do total de mensagens não lidas, compartilhada entre o menu lateral
 * (badge) e a tela de Chats — evita que os dois exibam números divergentes.
 */
@Injectable({ providedIn: 'root' })
export class ChatNotificationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly API_URL = `${environment.apiUrl}/chat`;

  totalNaoLidas = signal(0);

  carregarTotalNaoLidas() {
    const idEmpresa = this.authService.empresaIdSignal();
    if (!idEmpresa) return;

    this.http.get<{ value: { chats: ChatResumo[] } }>(`${this.API_URL}/conversas/${idEmpresa}`)
      .subscribe({
        next: (res) => this.setFromChats(res.value?.chats || []),
        error: (err) => console.error('Erro ao carregar total de mensagens não lidas:', err)
      });
  }

  setFromChats(chats: ChatResumo[]) {
    const total = chats.reduce((soma, c) => soma + (c.quantidadeNaoLidas || 0), 0);
    this.totalNaoLidas.set(total);
  }
}
