import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

interface ChatItem {
  contatoId: string;
  nomeContato: string;
  telefone: string;
  ultimaMensagem: string;
  dataUltimaMensagem: string;
  quantidadeNaoLidas: number;
  color?: string;
  initials?: string;
}

interface Message {
  from: 'bot' | 'user' | 'step' | 'recebida' | 'enviada';
  text: string;
  time?: string;
}

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chats.component.html',
  styleUrls: ['./chats.component.css'],
})
export class ChatsComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Obtém reativamente o Id da Empresa logada do AuthService
  private empresaId = this.authService.empresaIdSignal;

  // URLs base dos controllers
  private readonly API_URL = `${environment.apiUrl}/chat`;
  private readonly DISPARADOR_URL = `${environment.apiUrl}/disparador`;

  search = signal('');
  selectedId = signal<string | null>(null);
  draft = signal('');
  response = signal('');

  chats = signal<ChatItem[]>([]);
  activeMessages = signal<Message[]>([]);

  private colors = [
    'linear-gradient(135deg,#3D6EE8,#4B7BFF)',
    'linear-gradient(135deg,#F59E0B,#FBBF24)',
    'linear-gradient(135deg,#22C55E,#4ADE80)',
    'linear-gradient(135deg,#6366F1,#8B5CF6)'
  ];

  ngOnInit() {
    this.carregarConversas();
  }

  carregarConversas() {
    const idEmpresa = this.empresaId();
    if (!idEmpresa) {
      this.response.set('⚠ Empresa não identificada no sistema.');
      return;
    }

    this.http.get<{ value: { chats: ChatItem[] } }>(`${this.API_URL}/conversas/${idEmpresa}`)
      .subscribe({
        next: (res) => {
          const dadosTratados = (res.value?.chats || []).map((c, index) => ({
            ...c,
            initials: c.nomeContato ? c.nomeContato.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'CT',
            color: this.colors[index % this.colors.length]
          }));
          this.chats.set(dadosTratados);
        },
        error: (err) => {
          console.error(err);
          this.response.set('❌ Erro ao carregar chats ativos.');
        }
      });
  }

  carregarMensagens(contatoId: string) {
    const idEmpresa = this.empresaId();
    if (!idEmpresa) return;

    this.http.get<{ value: Message[] }>(`${this.API_URL}/mensagens/${idEmpresa}/${contatoId}`)
      .subscribe({
        next: (res) => {
          // Normaliza o retorno 'recebida'/'enviada' para bater com as classes de alinhamento do CSS
          const mensagensNormais = (res.value || []).map(m => ({
            ...m,
            // 'recebida' vira 'user' (Esquerda) | 'enviada' vira 'bot' (Direita)
            from: m.from === 'recebida' ? 'user' : m.from === 'enviada' ? 'bot' : m.from
          }));
          this.activeMessages.set(mensagensNormais);
        },
        error: (err) => console.error('Erro ao buscar histórico', err)
      });
  }

  filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.chats();
    return this.chats().filter(c =>
      c.nomeContato.toLowerCase().includes(q) || c.telefone.includes(q)
    );
  });

  selected = computed(() => this.chats().find(c => c.contatoId === this.selectedId()) ?? null);
  selectedMessages = computed(() => this.activeMessages());

  select(id: string) {
    this.selectedId.set(id);
    this.carregarMensagens(id);

    // 1) Zera visualmente a quantidade de não lidas imediatamente na UI
    this.chats.update(lista =>
      lista.map(c => c.contatoId === id ? { ...c, quantidadeNaoLidas: 0 } : c)
    );

    // 2) Avisa o backend para atualizar o status no banco de dados
    const idEmpresa = this.empresaId();
    if (idEmpresa) {
      this.http.post(`${this.API_URL}/marcar-como-lida`, { empresaId: idEmpresa, contatoId: id })
        .subscribe({
          next: () => console.log('Conversa marcada como lida no servidor.'),
          error: (err) => console.error('Erro ao marcar conversa como lida:', err)
        });
    }
  }

  send() {
    const text = this.draft().trim();
    const idContato = this.selectedId();
    const idEmpresa = this.empresaId();
    const chatAtivo = this.selected();

    if (!text || idContato == null || !idEmpresa || !chatAtivo) return;

    // Payload estruturado para a API do Disparador (Texto Livre)
    const payload = {
      celular: chatAtivo.telefone,
      template: '',
      textoMensagem: text,
      empresaId: idEmpresa,
      contatoId: idContato
    };

    // Limpa o input de texto imediatamente
    this.draft.set('');

    // Dispara o POST de envio para o Meta Integration
    this.http.post(`${this.DISPARADOR_URL}/enviar-mensagem-meta`, payload)
      .subscribe({
        next: () => {
          const now = new Date();
          const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

          // Adiciona a mensagem localmente no chat (lado direito)
          this.activeMessages.update(msgs => [
            ...msgs,
            { from: 'bot', text: text, time: timeStr }
          ]);

          // Atualiza a barra lateral com a última mensagem enviada
          this.chats.update(lista =>
            lista.map(c => c.contatoId === idContato
              ? { ...c, ultimaMensagem: text, dataUltimaMensagem: now.toISOString() }
              : c
            )
          );
        },
        error: (err) => {
          console.error('Erro ao disparar mensagem:', err);
          this.response.set('❌ Erro ao enviar a mensagem. Verifique a conexão.');
        }
      });
  }
}
