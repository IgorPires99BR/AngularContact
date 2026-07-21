import { Component, signal, computed, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import * as signalR from '@microsoft/signalr';

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
  contatoId?: string;
}

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chats.component.html',
  styleUrls: ['./chats.component.css'],
})
export class ChatsComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private empresaId = this.authService.empresaIdSignal;

  private readonly API_URL = `${environment.apiUrl}/chat`;
  private readonly DISPARADOR_URL = `${environment.apiUrl}/disparador`;

  private hubConnection?: signalR.HubConnection;
  private shouldScrollToBottom = false;

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
    this.iniciarSignalR();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy() {
    this.hubConnection?.stop();
  }

  // --- CONEXÃO SIGNALR EM TEMPO REAL ---
  private iniciarSignalR() {
    const idEmpresa = this.empresaId();
    if (!idEmpresa) return;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/chat`)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.start()
      .then(() => {
        console.log('SignalR Conectado!');
        this.hubConnection?.invoke('EntrarNoGrupo', idEmpresa);
      })
      .catch(err => console.error('Erro ao conectar SignalR:', err));

    this.hubConnection.on('ReceberNovaMensagem', (mensagemRecebida: any) => {
      this.tratarMensagemEmTempoReal(mensagemRecebida);
    });
  }

  private tratarMensagemEmTempoReal(msg: any) {
    const contatoIdMsg = msg.contatoId || msg.ContatoId;
    const conteudo = msg.conteudo || msg.Conteudo || msg.text || msg;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. Se a mensagem recebida pertence ao chat aberto no momento
    if (this.selectedId() === contatoIdMsg) {
      this.activeMessages.update(msgs => [
        ...msgs,
        { from: 'user', text: conteudo, time: timeStr }
      ]);
      this.shouldScrollToBottom = true;
    }

    // 2. Atualiza a lista lateral com a última mensagem e contador
    this.chats.update(lista =>
      lista.map(c => {
        if (c.contatoId === contatoIdMsg) {
          const isSelected = this.selectedId() === contatoIdMsg;
          return {
            ...c,
            ultimaMensagem: conteudo,
            dataUltimaMensagem: now.toISOString(),
            quantidadeNaoLidas: isSelected ? 0 : (c.quantidadeNaoLidas + 1)
          };
        }
        return c;
      })
    );
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) { }
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
          const mensagensNormais = (res.value || []).map(m => ({
            ...m,
            from: m.from === 'recebida' ? 'user' : m.from === 'enviada' ? 'bot' : m.from
          }));
          this.activeMessages.set(mensagensNormais);
          this.shouldScrollToBottom = true;
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

    this.chats.update(lista =>
      lista.map(c => c.contatoId === id ? { ...c, quantidadeNaoLidas: 0 } : c)
    );

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

    const payload = {
      celular: chatAtivo.telefone,
      template: '',
      textoMensagem: text,
      empresaId: idEmpresa,
      contatoId: idContato
    };

    this.draft.set('');

    this.http.post(`${this.DISPARADOR_URL}/enviar-mensagem-meta`, payload)
      .subscribe({
        next: () => {
          const now = new Date();
          const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

          this.activeMessages.update(msgs => [
            ...msgs,
            { from: 'bot', text: text, time: timeStr }
          ]);

          this.chats.update(lista =>
            lista.map(c => c.contatoId === idContato
              ? { ...c, ultimaMensagem: text, dataUltimaMensagem: now.toISOString() }
              : c
            )
          );

          this.shouldScrollToBottom = true;
        },
        error: (err) => {
          console.error('Erro ao disparar mensagem:', err);
          this.response.set('❌ Erro ao enviar a mensagem. Verifique a conexão.');
        }
      });
  }
}
