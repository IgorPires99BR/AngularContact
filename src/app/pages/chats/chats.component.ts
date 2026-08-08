import { Component, signal, computed, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { ChatNotificationService } from '../../core/services/chat-notification';
import { environment } from '../../../environments/environment';
import * as signalR from '@microsoft/signalr';
import { TemplateMessagePipe } from '../../shared/pipes/template-message.pipe';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

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
  wamid?: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
}

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, FormsModule, TemplateMessagePipe],
  templateUrl: './chats.component.html',
  styleUrls: ['./chats.component.css'],
})
export class ChatsComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private chatNotification = inject(ChatNotificationService);

  private empresaId = this.authService.empresaIdSignal;

  private readonly API_URL = `${environment.apiUrl}/chat`;
  private readonly DISPARADOR_URL = `${environment.apiUrl}/disparador`;

  private hubConnection?: signalR.HubConnection;
  private shouldScrollToBottom = false;
  private shouldRestoreScroll: number | null = null;

  private readonly TAMANHO_PAGINA = 30;
  private paginaAtual = 0;
  temMaisMensagens = signal(true);
  carregandoPagina = signal(false);

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
    if (this.shouldRestoreScroll !== null) {
      const el = this.scrollContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight - this.shouldRestoreScroll;
      }
      this.shouldRestoreScroll = null;
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

    this.hubConnection.on('AtualizaStatusEntrega', (evt: any) => {
      this.tratarStatusEntregaEmTempoReal(evt);
    });
  }

  private tratarStatusEntregaEmTempoReal(evt: any) {
    const wamid = evt?.wamid || evt?.Wamid;
    const status = evt?.status || evt?.Status;
    if (!wamid || !status) return;

    this.activeMessages.update(msgs =>
      msgs.map(m => m.wamid === wamid ? { ...m, status } : m)
    );
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
    this.chatNotification.setFromChats(this.chats());
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
          this.chatNotification.setFromChats(dadosTratados);
        },
        error: (err) => {
          this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao carregar chats ativos.')}`);
        }
      });
  }

  carregarMensagens(contatoId: string) {
    const idEmpresa = this.empresaId();
    if (!idEmpresa) return;

    this.paginaAtual = 0;
    this.temMaisMensagens.set(true);

    this.http.get<{ value: Message[] }>(`${this.API_URL}/mensagens/${idEmpresa}/${contatoId}?pagina=0&tamanho=${this.TAMANHO_PAGINA}`)
      .subscribe({
        next: (res) => {
          const mensagensNormais = this.normalizar(res.value || []);
          this.activeMessages.set(mensagensNormais);
          this.temMaisMensagens.set(mensagensNormais.length === this.TAMANHO_PAGINA);
          this.shouldScrollToBottom = true;
        },
        error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao buscar histórico de mensagens.')}`)
      });
  }

  // Infinite scroll: chamado quando o usuario rola pro topo da janela de mensagens
  onScrollTop() {
    const el = this.scrollContainer?.nativeElement;
    if (!el || el.scrollTop > 80 || !this.temMaisMensagens() || this.carregandoPagina()) return;

    const idEmpresa = this.empresaId();
    const idContato = this.selectedId();
    if (!idEmpresa || !idContato) return;

    this.carregandoPagina.set(true);
    const proximaPagina = this.paginaAtual + 1;

    this.http.get<{ value: Message[] }>(`${this.API_URL}/mensagens/${idEmpresa}/${idContato}?pagina=${proximaPagina}&tamanho=${this.TAMANHO_PAGINA}`)
      .subscribe({
        next: (res) => {
          const antigas = this.normalizar(res.value || []);
          this.temMaisMensagens.set(antigas.length === this.TAMANHO_PAGINA);
          this.paginaAtual = proximaPagina;

          if (antigas.length > 0) {
            this.shouldRestoreScroll = el.scrollHeight; // restaura a posicao visual apos o prepend
            this.activeMessages.update(msgs => [...antigas, ...msgs]);
          }
          this.carregandoPagina.set(false);
        },
        error: (err) => {
          console.error('Erro ao carregar mensagens antigas', err);
          this.carregandoPagina.set(false);
        }
      });
  }

  private normalizar(mensagens: Message[]): Message[] {
    return mensagens.map(m => ({
      ...m,
      from: m.from === 'recebida' ? 'user' : m.from === 'enviada' ? 'bot' : m.from
    }));
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
    this.chatNotification.setFromChats(this.chats());

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

    this.http.post<any>(`${this.DISPARADOR_URL}/enviar-mensagem-meta`, payload)
      .subscribe({
        next: (resposta) => {
          const now = new Date();
          const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

          // Captura o wamid retornado pelo envio, usado pra casar com os eventos de
          // status de entrega (sent/delivered/read) que chegam depois via SignalR.
          const wamid = resposta?.value?.wamidMeta || resposta?.value?.wamid || resposta?.wamidMeta || resposta?.wamid;

          this.activeMessages.update(msgs => [
            ...msgs,
            { from: 'bot', text: text, time: timeStr, wamid, status: 'sent' }
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
          this.response.set(`❌ Erro ao enviar a mensagem: ${extrairMensagemErro(err, 'Verifique a conexão.')}`);
        }
      });
  }
}
