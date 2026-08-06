import { Component, signal, computed, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { ChatNotificationService } from '../../core/services/chat-notification';
import { environment } from '../../../environments/environment';
import * as signalR from '@microsoft/signalr';
import { TemplateMessagePipe } from '../../shared/pipes/template-message.pipe';

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
  midiaId?: string;
  tipoMidia?: 'image' | 'audio' | 'document';
  previewUrl?: string;
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
          console.error(err);
          this.response.set('❌ Erro ao carregar chats ativos.');
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
        error: (err) => console.error('Erro ao buscar histórico', err)
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
      from: m.from === 'recebida' ? 'user' : m.from === 'enviada' ? 'bot' : m.from,
      midiaId: m.midiaId,
      tipoMidia: m.tipoMidia
    }));
  }

  // O endpoint de mídia exige o token JWT (Authorization: Bearer), mas uma tag <img>/<audio>
  // com [src] direto pra URL não consegue mandar esse header -- o navegador faz a requisição
  // sem autenticação e recebe 401, aparecendo como imagem quebrada. Por isso baixamos o
  // arquivo via HttpClient (que já anexa o token pelo interceptor) e criamos uma blob URL
  // local, cacheada por midiaId pra não baixar de novo toda vez que o Angular re-renderiza.
  private mediaBlobUrls = signal<Record<string, string>>({});

  mediaUrl(midiaId?: string): string {
    if (!midiaId) return '';

    const cache = this.mediaBlobUrls();
    if (cache[midiaId]) return cache[midiaId];

    this.carregarMidia(midiaId);
    return '';
  }

  private carregarMidia(midiaId: string) {
    const idEmpresa = this.empresaId();
    if (!idEmpresa) return;

    // Evita disparar o download de novo enquanto a primeira chamada ainda não voltou
    if ((midiaId in this.mediaBlobUrls()) || this.midiasCarregando.has(midiaId)) return;
    this.midiasCarregando.add(midiaId);

    this.http.get(`${this.API_URL}/midia/${midiaId}?empresaId=${idEmpresa}`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.mediaBlobUrls.update(map => ({ ...map, [midiaId]: url }));
          this.midiasCarregando.delete(midiaId);
        },
        error: (err) => {
          console.error('Erro ao carregar mídia', midiaId, err);
          this.midiasCarregando.delete(midiaId);
        }
      });
  }

  private midiasCarregando = new Set<string>();

  // Dispara pelo botão de anexo, envia o arquivo escolhido como mídia pra Meta
  enviarArquivo(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const tipoMidia: 'image' | 'audio' | 'document' = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'document';

    this.enviarMidia(file, tipoMidia);
    input.value = '';
  }

  // --- GRAVAÇÃO DE ÁUDIO PELO MICROFONE ---
  gravandoAudio = signal(false);
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];

  async alternarGravacao() {
    if (this.gravandoAudio()) {
      this.mediaRecorder?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.response.set('❌ Seu navegador não permite gravar áudio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      // A Meta so aceita audio/aac, audio/mp4, audio/mpeg, audio/amr ou audio/ogg (opus) --
      // o mimeType padrao do MediaRecorder no Chrome/Edge e audio/webm, que a API rejeita
      // (erro 400 "(#100) Param file must be a file with one of the following types...").
      // Tenta os formatos aceitos na ordem, e so cai pro webm se nenhum estiver disponivel.
      const mimeTypesAceitos = ['audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus', 'audio/ogg'];
      const mimeType = mimeTypesAceitos.find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        this.gravandoAudio.set(false);

        if (this.audioChunks.length === 0) return;

        if (mimeType === 'audio/webm') {
          this.response.set('❌ Seu navegador só grava em um formato que o WhatsApp não aceita (webm). Tente pelo Safari/iPhone ou anexe um arquivo de áudio já gravado.');
          return;
        }

        const extensao = mimeType.startsWith('audio/mp4') ? 'm4a' : mimeType.startsWith('audio/aac') ? 'aac' : 'ogg';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        const arquivo = new File([blob], `audio-${Date.now()}.${extensao}`, { type: mimeType });
        this.enviarMidia(arquivo, 'audio');
      };

      this.mediaRecorder.start();
      this.gravandoAudio.set(true);
    } catch (err) {
      console.error('Erro ao acessar o microfone:', err);
      this.response.set('❌ Não foi possível acessar o microfone. Verifique a permissão do navegador.');
    }
  }

  // Compartilhado entre o anexo de arquivo e a gravação de áudio pelo microfone
  private enviarMidia(file: File, tipoMidia: 'image' | 'audio' | 'document') {
    const idContato = this.selectedId();
    const idEmpresa = this.empresaId();
    const chatAtivo = this.selected();

    if (!idContato || !idEmpresa || !chatAtivo) return;

    const previewUrl = URL.createObjectURL(file);

    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('celular', chatAtivo.telefone);
    formData.append('empresaId', idEmpresa);
    formData.append('contatoId', idContato);
    formData.append('tipoMidia', tipoMidia);

    this.http.post<any>(`${this.DISPARADOR_URL}/enviar-midia-meta`, formData)
      .subscribe({
        next: (resposta) => {
          const now = new Date();
          const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
          const wamid = resposta?.value?.wamidMeta || resposta?.value?.wamid || resposta?.wamidMeta || resposta?.wamid;

          this.activeMessages.update(msgs => [
            ...msgs,
            {
              from: 'bot',
              text: `[${tipoMidia}]`,
              time: timeStr,
              wamid,
              status: 'sent',
              tipoMidia,
              previewUrl
            }
          ]);

          this.chats.update(lista =>
            lista.map(c => c.contatoId === idContato
              ? { ...c, ultimaMensagem: `[${tipoMidia}]`, dataUltimaMensagem: now.toISOString() }
              : c
            )
          );

          this.shouldScrollToBottom = true;
        },
        error: (err) => {
          console.error('Erro ao enviar mídia:', err);
          // O backend manda o motivo real (ex: erro da propria Meta) em err.error.erros --
          // antes essa mensagem generica escondia o motivo, so aparecia expandindo o
          // objeto no console.
          // Cobre tanto o formato de erro custom do projeto ({erros:[...]}/{erro:...}) quanto
          // o ProblemDetails automatico do ASP.NET Core ({errors:{campo:["msg"]}, title:...}),
          // que aparece quando um campo do multipart nao bate com o tipo esperado no controller
          // (isso acontecia ANTES do nosso codigo rodar, entao o formato de erro era diferente).
          const errorsDoAspNet = err?.error?.errors
            ? Object.values(err.error.errors).flat().join(', ')
            : null;
          const motivo = err?.error?.erros?.[0] || err?.error?.erro || errorsDoAspNet || err?.error?.title
            || `${err?.status ?? ''} ${err?.statusText ?? ''}`.trim() || 'Verifique a conexão.';
          this.response.set(`❌ Erro ao enviar o arquivo: ${motivo}`);
        }
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
          console.error('Erro ao disparar mensagem:', err);
          this.response.set('❌ Erro ao enviar a mensagem. Verifique a conexão.');
        }
      });
  }
}
