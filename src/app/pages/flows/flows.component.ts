import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

export interface Step {
  id: string;
  ordem: number;          // Alinhado com o DTO do Back-end
  tipoStep: string;        // Mudado de 'nomeEtapa' para 'tipoStep'
  mensagemPergunta: string; // Mudado de 'conteudoLivre' para 'mensagemPergunta'
  variavelSaida?: string; // Tornou-se opcional (?) ou string vazia
  gatilhoResposta?: string;
  proximaEtapaId?: string | null;
  ehEtapaInicial?: boolean;
  templateId?: string;
}

export interface Flow {
  id: string;
  idEmpresa: string;      // Vinculado ao ecossistema multi-tenant
  nome: string;
  descricao: string;
  gatilhoPalavraChave: string;
  ativo: boolean;
  clients?: number;       // Controle visual mantido no front
  etapas: Step[];
}

@Component({
  selector: 'app-flows',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './flows.component.html',
  styleUrls: ['../shared-crud.css', './flows.component.css'],
})
export class FlowsComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // URL base extraída diretamente do Swagger: /api/config/flow
  private readonly API_URL = `${environment.apiUrl}/config/flow`;

  // ID da empresa logada vindo do serviço global de autenticação
  private idEmpresaLogada = this.authService.empresaIdSignal;

  // Controle de Abas e Estados de UI
  Math = Math;
  tab = signal<'builder' | 'monitor' | 'saved'>('builder');
  response = signal('');
  sincronizando = signal(false);

  // Estado dos dados
  flows = signal<Flow[]>([]);
  selectedId = signal<string>('');

  // Computeds para os contadores visuais e estatísticas
  ativos = computed(() => this.flows().filter(f => f.ativo).length);
  inativos = computed(() => this.flows().filter(f => !f.ativo).length);
  totalSteps = computed(() => this.flows().reduce((acc, f) => acc + f.etapas.length, 0));

  // Provedor do item selecionado na árvore de edição
  selected = computed(() => this.flows().find(f => f.id === this.selectedId()) ?? this.flows()[0]);

  stepTypes = [
    { value: 'Mensagem', label: 'Mensagem' },
    { value: 'Capturar Input', label: 'Capturar Input' },
    { value: 'Condição', label: 'Condição' },
    { value: 'Encerrar', label: 'Encerrar' },
  ];

  ngOnInit() {
    this.buscar();
  }

  // 1. LISTAR FLOWS (GET /api/config/flow)
  buscar() {
    const empId = this.idEmpresaLogada();

    if (!empId) {
      console.warn('⚠️ Aguardando ID da empresa para listar os fluxos.');
      return;
    }

    // Ajustado para refletir o envelope de resposta do .NET: { value: [...], erros: [], hasValidations: false }
    this.http.get<{ value: any[] }>(`${this.API_URL}/${empId}`).subscribe({
      next: (res) => {
        // Verifica se a propriedade 'value' existe e possui itens
        if (!res || !res.value || !Array.isArray(res.value)) {
          this.flows.set([]);
          return;
        }

        // Mapeia a partir de res.value
        const mapeados: Flow[] = res.value.map(f => {
          // Trata o array de etapas interno do fluxo
          const etapasRaw = f.etapas || f.Etapas || [];

          const etapasOrdenadas = etapasRaw.map((e: any) => ({
            id: e.id || e.Id,
            ordem: e.ordem !== undefined ? e.ordem : e.Ordem,
            tipoStep: e.tipoStep || e.TipoStep || e.nomeEtapa || e.NomeEtapa, // Fallback seguro
            mensagemPergunta: e.mensagemPergunta || e.MensagemPergunta || e.conteudoLivre || e.ConteudoLivre,
            variavelSaida: e.variavelSaida || e.VariavelSaida || '',
            gatilhoResposta: e.gatilhoResposta || e.GatilhoResposta,
            proximaEtapaId: e.proximaEtapaId || e.ProximaEtapaId,
            ehEtapaInicial: e.ehEtapaInicial !== undefined ? e.ehEtapaInicial : e.EhEtapaInicial,
            templateId: e.templateId || e.TemplateId
          })).sort((a: any, b: any) => a.ordem - b.ordem);

          // Retorna o objeto Flow mapeado estritamente para o padrão do seu Front-end
          return {
            id: f.id || f.Id,
            idEmpresa: f.idEmpresa || f.IdEmpresa || f.empresaId || f.EmpresaId,
            nome: f.nome || f.Nome,
            descricao: f.descricao || f.Descricao,
            // Fallback robusto caso a palavra-chave venha nula do banco
            gatilhoPalavraChave: f.gatilhoPalavraChave || f.GatilhoPalavraChave || '',
            ativo: f.ativo !== undefined ? f.ativo : f.Ativo,
            clients: f.clients || f.Clients || 0,
            etapas: etapasOrdenadas
          };
        });

        this.flows.set(mapeados);

        // Sincroniza o primeiro item na tela de edição imediatamente após carregar
        if (mapeados.length > 0) {
          const currentId = this.selectedId();
          // Se não houver ID selecionado ou o ID atual não fizer parte da nova lista, força o primeiro
          if (!currentId || !mapeados.some(f => f.id === currentId)) {
            this.selectedId.set(mapeados[0].id);
          }
        }
      },
      error: (err) => {
        console.error('Erro ao buscar flows:', err);
        this.response.set('❌ Erro ao carregar fluxos do servidor para esta empresa.');
      }
    });
  }

  // 2. SALVAR OU ALTERAR FLOW (POST ou PUT /api/config/flow)
  salvar() {
    const fluxoAtual = this.selected();
    const empId = this.idEmpresaLogada();

    if (!fluxoAtual || !empId) {
      this.response.set('❌ Sessão expirada ou fluxo inválido.');
      return;
    }

    if (!fluxoAtual.nome || !fluxoAtual.gatilhoPalavraChave) {
      this.response.set('❌ Nome do fluxo e palavra-chave são obrigatórios.');
      return;
    }

    this.sincronizando.set(true);
    this.response.set('⏳ Sincronizando fluxo com o banco de dados...');

    // Mapeia o objeto local para o contrato estrito que o C# espera
    const payloadToPost = {
      id: fluxoAtual.id,
      idEmpresa: empId,
      nome: fluxoAtual.nome,
      descricao: fluxoAtual.descricao,
      gatilhoPalavraChave: fluxoAtual.gatilhoPalavraChave,
      ativo: fluxoAtual.ativo,
      etapas: fluxoAtual.etapas.map(e => ({
        id: e.id,
        ordem: e.ordem,
        tipoStep: e.tipoStep,          // De 'nomeEtapa' para 'tipoStep'
        mensagemPergunta: e.mensagemPergunta, // De 'conteudoLivre' para 'mensagemPergunta'
        variavelSaida: e.variavelSaida || '',
        gatilhoResposta: e.gatilhoResposta,
        proximaEtapaId: e.proximaEtapaId,
        ehEtapaInicial: e.ehEtapaInicial,
        templateId: e.templateId
      }))
    };

    const { isNew } = fluxoAtual as any;

    if (isNew === false || !isNew) {
      this.http.put(this.API_URL, payloadToPost).subscribe({
        next: () => this.processarSucesso('✅ Fluxo atualizado com sucesso!'),
        error: (err) => this.processarErro(err, 'Erro ao atualizar fluxo.')
      });
    } {
      this.http.post(this.API_URL, payloadToPost).subscribe({
        next: () => {
          (fluxoAtual as any).isNew = false;
          this.processarSucesso('✅ Novo fluxo registrado com sucesso!');
        },
        error: (err) => this.processarErro(err, 'Erro ao criar fluxo.')
      });
    }
  }

  // 3. EXCLUIR FLOW (DELETE /api/config/flow/{id})
  excluir(id: string) {
    if (!confirm('Deseja realmente remover este fluxo de conversa? Isso apagará todas as etapas vinculadas.')) return;

    this.response.set('⏳ Removendo fluxo...');
    this.http.delete(`${this.API_URL}/${id}`).subscribe({
      next: () => {
        this.flows.update(list => list.filter(f => f.id !== id));
        this.response.set('✅ Fluxo removido com sucesso.');
        if (this.selectedId() === id && this.flows().length > 0) {
          this.selectedId.set(this.flows()[0].id);
        }
      },
      error: () => this.response.set('❌ Erro ao tentar excluir o fluxo do servidor.')
    });
  }

  // Métodos Auxiliares de Gerenciamento Local
  newFlow() {
    const novoGuid = crypto.randomUUID();
    const f: Flow & { isNew?: boolean } = {
      id: novoGuid,
      idEmpresa: this.idEmpresaLogada() || '',
      nome: 'Novo Flow',
      descricao: '',
      gatilhoPalavraChave: '',
      ativo: false,
      clients: 0,
      etapas: [],
      isNew: true // <-- Essa flag garante que o sistema saiba que ele DEVE ser criado (POST)
    };
    this.flows.set([f, ...this.flows()]);
    this.selectedId.set(novoGuid);
    this.tab.set('builder');
    this.response.set('✨ Novo fluxo engatado na memória. Clique em Salvar para persistir.');
  }

  addStep() {
    const f = this.selected();
    if (!f) return;

    const novaOrdem = f.etapas.length + 1;

    // 1. Criamos a nova etapa com a tipagem e campos que o Back-end exige
    const novaEtapa: Step = {
      id: crypto.randomUUID(),
      ordem: novaOrdem,
      tipoStep: 'Mensagem',          // Alinhado com TipoStep (antigo nomeEtapa)
      mensagemPergunta: '',          // Alinhado com MensagemPergunta (antigo conteudoLivre)
      variavelSaida: '',             // Enviando vazio para evitar o erro de validação do 400
      ehEtapaInicial: novaOrdem === 1,
      gatilhoResposta: 'Avancar',
      proximaEtapaId: null
    };

    // 2. Atualizamos a lista de etapas criando um novo array para garantir a reatividade do Signal
    f.etapas = [...f.etapas, novaEtapa];

    // 3. Notificamos o Signal da mudança
    this.flows.set([...this.flows()]);
  }

  removeStep(stepId: string) {
    const f = this.selected();
    if (!f) return;

    // Remove e reorganiza a propriedade ordem sequencialmente
    f.etapas = f.etapas
      .filter(s => s.id !== stepId)
      .map((s, index) => ({ ...s, ordem: index + 1 }));

    this.flows.set([...this.flows()]);
  }

  updateFlowField(field: keyof Flow, value: any) {
    const f = this.selected();
    if (!f) return;
    (f as any)[field] = value;
    this.flows.set([...this.flows()]);
  }

  updateStep(stepId: string, partial: Partial<Step>) {
    const f = this.selected();
    if (!f) return;
    f.etapas = f.etapas.map(s => s.id === stepId ? { ...s, ...partial } : s);
    this.flows.set([...this.flows()]);
  }

  select(id: string) {
    this.selectedId.set(id);
  }

  stepLabel(t: string) {
    return this.stepTypes.find(s => s.value === t)?.label ?? t;
  }

  badgeClass(ativo: boolean) {
    return ativo ? 'badge-green' : 'badge-muted';
  }

  statusLabel(ativo: boolean) {
    return ativo ? 'Ativo' : 'Inativo';
  }

  private processarSucesso(msg: string) {
    this.response.set(msg);
    this.sincronizando.set(false);
    this.buscar();
  }

  private processarErro(err: any, msgPadrao: string) {
    console.error(err);
    this.response.set(`❌ ${err.error?.message || msgPadrao}`);
    this.sincronizando.set(false);
  }
}
