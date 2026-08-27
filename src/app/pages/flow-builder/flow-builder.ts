import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';
import { NumeroSelectorComponent } from '../../shared/numero-selector/numero-selector';
import { FlowEtapasEditorComponent, Step } from './flow-etapas-editor/flow-etapas-editor';

interface Flow {
  id: string;
  idEmpresa: string;
  nome: string;
  descricao: string;
  gatilhoPalavraChave: string;
  ativo: boolean;
  numeroId: string | null;
  // Anúncio que leva a este flow. A tela ainda não edita, mas carrega e devolve ao salvar
  // para não desfazer o roteamento configurado pela API.
  sourceIdAnuncio?: string | null;
  etapas: Step[];
}

interface ParteMensagem {
  texto: string;
  variavel: boolean;
}

interface BolhaPreview {
  tipo: 'bot' | 'cliente' | 'sistema';
  partes: ParteMensagem[];
}

// Tela dedicada de criação/edição de um Flow, extraída do antigo flows.component.ts
// (que misturava lista + builder + monitor numa única tela com abas). Separar em rota
// própria segue o mesmo padrão já usado por /templates x /templates/mapa.
@Component({
  selector: 'app-flow-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, NumeroSelectorComponent, FlowEtapasEditorComponent],
  templateUrl: './flow-builder.html',
  styleUrls: ['../flows/flows.component.css', './flow-builder.css'],
})
export class FlowBuilderComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private readonly API_URL = `${environment.apiUrl}/config/flow`;
  private idEmpresaLogada = this.authService.empresaIdSignal;

  response = signal('');
  sincronizando = signal(false);
  carregando = signal(true);
  mostrarToast = signal(false);

  private idRota: string | null = null;
  isNew = true;

  flow = signal<Flow>({
    id: '',
    idEmpresa: '',
    nome: '',
    descricao: '',
    gatilhoPalavraChave: '',
    ativo: true,
    numeroId: null,
    sourceIdAnuncio: null,
    etapas: []
  });

  // Simula a conversa que o cliente veria, na ordem real das etapas -- Mensagem vira
  // bolha do bot, Capturar Input vira a pergunta do bot seguida de uma bolha "do
  // cliente" esperando resposta. É o que diferencia essa tela de um formulário cru:
  // dá pra ver o resultado sem precisar publicar o flow e mandar mensagem de teste.
  previewBolhas = computed<BolhaPreview[]>(() => {
    const bolhas: BolhaPreview[] = [];
    for (const etapa of this.flow().etapas) {
      if (etapa.tipoStep === 'Mensagem' && etapa.mensagemPergunta) {
        bolhas.push({ tipo: 'bot', partes: this.partesMensagem(etapa.mensagemPergunta) });
      } else if (etapa.tipoStep === 'Capturar Input' && etapa.mensagemPergunta) {
        bolhas.push({ tipo: 'bot', partes: this.partesMensagem(etapa.mensagemPergunta) });
        bolhas.push({ tipo: 'cliente', partes: [{ texto: etapa.variavelSaida ? `(resposta salva em "${etapa.variavelSaida}")` : 'digitando...', variavel: false }] });
      } else if (etapa.tipoStep === 'Encerrar') {
        bolhas.push({ tipo: 'sistema', partes: [{ texto: '🏁 Conversa encerrada', variavel: false }] });
      }
    }
    return bolhas;
  });

  // Quebra "Olá {{nome}}!" em partes de texto normal + variável, pra destacar as
  // variáveis na prévia sem precisar de innerHTML (a mensagem é editada livremente
  // pelo usuário, então prefiro não injetar HTML cru mesmo sendo conteúdo do próprio
  // tenant).
  private partesMensagem(texto: string): ParteMensagem[] {
    const partes: ParteMensagem[] = [];
    const regex = /\{\{(\w+)\}\}/g;
    let ultimoIndice = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(texto)) !== null) {
      if (match.index > ultimoIndice) {
        partes.push({ texto: texto.slice(ultimoIndice, match.index), variavel: false });
      }
      partes.push({ texto: match[1], variavel: true });
      ultimoIndice = match.index + match[0].length;
    }
    if (ultimoIndice < texto.length) {
      partes.push({ texto: texto.slice(ultimoIndice), variavel: false });
    }
    return partes;
  }

  ngOnInit() {
    this.idRota = this.route.snapshot.paramMap.get('id');
    this.isNew = !this.idRota || this.idRota === 'novo';

    if (this.isNew) {
      this.flow.set({
        id: crypto.randomUUID(),
        idEmpresa: this.idEmpresaLogada() || '',
        nome: '',
        descricao: '',
        gatilhoPalavraChave: '',
        ativo: true,
        numeroId: this.route.snapshot.queryParamMap.get('numeroId'),
        etapas: []
      });
      this.carregando.set(false);
    } else {
      this.carregarFlowExistente(this.idRota!);
    }
  }

  private carregarFlowExistente(id: string) {
    const empId = this.idEmpresaLogada();
    if (!empId) {
      this.carregando.set(false);
      return;
    }

    // Não existe endpoint de GET por id -- a lista já carrega as etapas, então busca
    // todos os flows da empresa e filtra o que veio na rota (mesma limitação que a tela
    // antiga já tinha, só que antes escondida por já estar tudo numa única lista/estado).
    // GET /config/flow/{id} devolve o array puro, sem envelope { value: [...] } (ver nota
    // em flows.component.ts).
    this.http.get<any[]>(`${this.API_URL}/${empId}`).subscribe({
      next: (res) => {
        const lista = Array.isArray(res) ? res : [];
        const encontrado = lista.find(f => (f.id || f.Id) === id);

        if (!encontrado) {
          this.response.set('❌ Flow não encontrado.');
          this.carregando.set(false);
          return;
        }

        this.flow.set(this.mapearFlow(encontrado));
        this.carregando.set(false);
      },
      error: (err) => {
        this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao carregar o flow.')}`);
        this.carregando.set(false);
      }
    });
  }

  // Id da etapa de destino -> ordem dela na lista. Null quando a etapa não ramifica.
  private ordemDaEtapa(etapas: Step[], idDestino?: string | null): number | null {
    if (!idDestino) return null;
    return etapas.find(e => e.id === idDestino)?.ordem ?? null;
  }

  private mapearFlow(f: any): Flow {
    const etapasRaw = f.etapas || f.Etapas || [];
    const etapasMapeadas: Step[] = etapasRaw.map((e: any) => ({
      id: e.id || e.Id,
      ordem: e.ordem !== undefined ? e.ordem : e.Ordem,
      tipoStep: e.tipoStep || e.TipoStep || e.nomeEtapa || e.NomeEtapa,
      mensagemPergunta: e.mensagemPergunta || e.MensagemPergunta || e.conteudoLivre || e.ConteudoLivre,
      variavelSaida: e.variavelSaida || e.VariavelSaida || '',
      gatilhoResposta: e.gatilhoResposta || e.GatilhoResposta,
      proximaEtapaId: e.proximaEtapaId || e.ProximaEtapaId,
      ehEtapaInicial: e.ehEtapaInicial !== undefined ? e.ehEtapaInicial : e.EhEtapaInicial,
      templateId: e.templateId || e.TemplateId,
      botao1: e.botao1 || e.Botao1,
      botao2: e.botao2 || e.Botao2,
      proximaEtapaIdB: e.proximaEtapaIdB || e.ProximaEtapaIdB
    }));

    return {
      id: f.id || f.Id,
      idEmpresa: f.idEmpresa || f.IdEmpresa || f.empresaId || f.EmpresaId,
      nome: f.nome || f.Nome,
      descricao: f.descricao || f.Descricao,
      gatilhoPalavraChave: f.gatilhoPalavraChave || f.GatilhoPalavraChave || '',
      ativo: f.ativo !== undefined ? f.ativo : f.Ativo,
      numeroId: f.numeroId || f.NumeroId || null,
      sourceIdAnuncio: f.sourceIdAnuncio || f.SourceIdAnuncio || null,
      etapas: this.ordenarPelaCorrente(etapasMapeadas)
    };
  }

  // Coloca as etapas na ordem de execução seguindo ProximaEtapaId a partir da etapa
  // inicial (não existe coluna "Ordem" persistida, então a ordem real é essa corrente).
  private ordenarPelaCorrente(etapas: Step[]): Step[] {
    if (etapas.length <= 1) return etapas;

    const porId = new Map(etapas.map(e => [e.id, e]));
    const inicial = etapas.find(e => e.ehEtapaInicial) ?? etapas[0];

    const ordenadas: Step[] = [];
    const visitados = new Set<string>();

    let atual: Step | undefined = inicial;
    while (atual && !visitados.has(atual.id)) {
      visitados.add(atual.id);
      ordenadas.push(atual);
      atual = atual.proximaEtapaId ? porId.get(atual.proximaEtapaId) : undefined;
    }

    for (const etapa of etapas) {
      if (!visitados.has(etapa.id)) ordenadas.push(etapa);
    }

    return ordenadas;
  }

  updateField(field: keyof Flow, value: any) {
    this.flow.set({ ...this.flow(), [field]: value });
  }

  onEtapasChange(etapas: Step[]) {
    this.flow.set({ ...this.flow(), etapas });
  }

  salvar() {
    const f = this.flow();
    const empId = this.idEmpresaLogada();

    if (!empId) {
      this.response.set('❌ Sessão expirada.');
      return;
    }
    if (!f.nome || !f.gatilhoPalavraChave) {
      this.response.set('❌ Nome do fluxo e palavra-chave são obrigatórios.');
      return;
    }

    this.sincronizando.set(true);
    this.response.set('⏳ Sincronizando fluxo com o banco de dados...');

    const payload = {
      id: f.id,
      idEmpresa: empId,
      nome: f.nome,
      descricao: f.descricao,
      gatilhoPalavraChave: f.gatilhoPalavraChave,
      ativo: f.ativo,
      numeroId: f.numeroId || null,
      // Preserva o vínculo com o anúncio: quem chega por ele cai neste flow direto, e salvar
      // pela tela não pode desfazer isso sem querer.
      sourceIdAnuncio: f.sourceIdAnuncio || null,
      etapas: f.etapas.map(e => ({
        // O id vai junto de propósito: é por ele que o backend reconhece a etapa que já existe
        // e a atualiza em vez de recriar. Etapa nova nasce sem id na tela e o backend gera.
        id: e.id,
        ordem: e.ordem,
        tipoStep: e.tipoStep,
        mensagemPergunta: e.mensagemPergunta,
        variavelSaida: e.variavelSaida || '',
        gatilhoResposta: e.gatilhoResposta,
        proximaEtapaId: e.proximaEtapaId,
        ehEtapaInicial: e.ehEtapaInicial,
        templateId: e.templateId,
        botao1: e.botao1 || null,
        botao2: e.botao2 || null,
        // O backend recria as etapas com Guids novos a cada salvamento, então a ramificação
        // é referenciada pela ORDEM da etapa de destino, não pelo Id antigo (que deixa de
        // existir). Traduz aqui o Id carregado para a ordem correspondente.
        ordemDestinoB: this.ordemDaEtapa(f.etapas, e.proximaEtapaIdB)
      }))
    };

    const request$ = this.isNew
      ? this.http.post(this.API_URL, payload)
      : this.http.put(this.API_URL, payload);

    request$.subscribe({
      next: () => {
        this.sincronizando.set(false);
        this.mostrarToast.set(true);
        // Deixa o toast visível um instante antes de sair da tela -- some sozinho
        // se o usuário não navegar antes (o componente é destruído na troca de rota).
        setTimeout(() => this.router.navigate(['/flows']), 700);
      },
      error: (err) => {
        this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao salvar o flow.')}`);
        this.sincronizando.set(false);
      }
    });
  }

  cancelar() {
    this.router.navigate(['/flows']);
  }
}
