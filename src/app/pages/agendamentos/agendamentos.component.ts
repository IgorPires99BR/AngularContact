import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';
import { TemplateService } from '../templates/template.service';
import { Template } from '../templates/template.models';
import { AgendamentoService } from './agendamento.service';
import {
  Agendamento, AgendamentoExecucao, AgendamentoVariavel, OrigemVariavelAgendamento,
  ROTULO_RECORRENCIA, TipoRecorrencia
} from './agendamento.models';

interface Contato {
  id: string;
  nome?: string;
  telefone: string;
  email?: string;
  checked?: boolean;
}

@Component({
  selector: 'app-agendamentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agendamentos.component.html',
  styleUrls: ['../shared-crud.css', './agendamentos.component.css'],
})
export class AgendamentosComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private templateService = inject(TemplateService);
  private agendamentoService = inject(AgendamentoService);

  private readonly API_CONTATO = `${environment.apiUrl}/contato`;

  private empresaId = this.authService.empresaIdSignal;
  private userId = this.authService.usuarioIdSignal;

  readonly rotuloRecorrencia = ROTULO_RECORRENCIA;

  agendamentos = signal<Agendamento[]>([]);
  templates = signal<Template[]>([]);
  contatos = signal<Contato[]>([]);
  search = signal('');
  response = signal('');
  salvando = signal(false);
  editingId = signal<string | null>(null);

  historicoAbertoId = signal<string | null>(null);
  execucoes = signal<AgendamentoExecucao[]>([]);
  carregandoHistorico = signal(false);

  form = signal({
    nome: '',
    templateId: '',
    tipoRecorrencia: 'DIARIA' as TipoRecorrencia,
    dataInicio: '',
    dataFim: '',
    dataReferencia: '',
  });

  variaveis = signal<AgendamentoVariavel[]>([]);

  contatosFiltrados = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.contatos();
    return this.contatos().filter(c =>
      (c.nome && c.nome.toLowerCase().includes(termo)) ||
      c.telefone.includes(termo) ||
      (c.email && c.email.toLowerCase().includes(termo))
    );
  });

  selecionados = computed(() => this.contatos().filter(c => c.checked));

  isAllSelected = computed(() => {
    const filtrados = this.contatosFiltrados();
    if (filtrados.length === 0) return false;
    return filtrados.every(c => c.checked);
  });

  ngOnInit() {
    this.buscarAgendamentos();
    this.buscarTemplates();
    this.buscarContatos();
  }

  buscarAgendamentos() {
    const empId = this.empresaId();
    if (!empId) return;
    this.agendamentoService.listar(empId).subscribe({
      next: (res) => this.agendamentos.set(res),
      error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao carregar agendamentos.')}`)
    });
  }

  buscarTemplates() {
    const empId = this.empresaId();
    if (!empId) return;
    this.templateService.listar(empId).subscribe({
      next: (res) => this.templates.set((res as Template[]).filter(t => t.status?.toUpperCase() === 'APPROVED')),
      error: () => this.response.set('❌ Erro ao carregar modelos de mensagem.')
    });
  }

  buscarContatos() {
    const uid = this.userId();
    if (!uid) return;
    this.http.get<Contato[]>(`${this.API_CONTATO}/obter-por-usuario/${uid}`)
      .subscribe({
        next: (res) => this.contatos.set(res.map(c => ({ ...c, checked: false }))),
        error: () => this.response.set('❌ Erro ao carregar contatos.')
      });
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  // Ao trocar o modelo, detecta as variáveis {{n}} do corpo e monta um campo para cada uma --
  // {{1}} quase sempre é o nome do cliente, então já sai marcado assim (mesmo comportamento
  // do Disparador). Sem isto, um agendamento com template de variável saía sem nenhum
  // parâmetro e a Meta recusava o disparo.
  onTemplateChange(templateId: string) {
    this.update('templateId', templateId);

    const tpl = this.templates().find(t => t.id === templateId);
    if (!tpl) {
      this.variaveis.set([]);
      return;
    }

    const matches = tpl.conteudo.match(/\{\{\d+\}\}/g) || [];
    this.variaveis.set(matches.map((_, i) => ({
      origem: (i === 0 ? 'nome' : 'fixo') as OrigemVariavelAgendamento,
      valorFixo: ''
    })));
  }

  updateVariavel(index: number, mudanca: Partial<AgendamentoVariavel>) {
    const lista = [...this.variaveis()];
    lista[index] = { ...lista[index], ...mudanca };
    this.variaveis.set(lista);
  }

  rotuloOrigem(origem: OrigemVariavelAgendamento): string {
    if (origem === 'nome') return 'nome do contato';
    if (origem === 'telefone') return 'telefone do contato';
    return 'valor fixo';
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByContatoId(_index: number, contato: Contato): string {
    return contato.id;
  }

  toggleContato(contato: Contato) {
    this.contatos.update(list => list.map(c =>
      c.id === contato.id ? { ...c, checked: !c.checked } : c
    ));
  }

  selAll() {
    const marcarTodos = !this.isAllSelected();
    const filtradosIds = this.contatosFiltrados().map(c => c.id);
    this.contatos.update(list => list.map(c =>
      filtradosIds.includes(c.id) ? { ...c, checked: marcarTodos } : c
    ));
  }

  salvar() {
    const f = this.form();
    const empId = this.empresaId();
    const alvos = this.selecionados();

    if (!f.nome.trim()) {
      this.response.set('❌ Informe o nome do agendamento.');
      return;
    }
    if (!f.templateId) {
      this.response.set('❌ Escolha o modelo de mensagem.');
      return;
    }
    if (!f.dataInicio) {
      this.response.set('❌ Informe a data de início da vigência.');
      return;
    }
    if (!f.dataReferencia) {
      this.response.set('❌ Informe a data e hora de referência do disparo.');
      return;
    }
    if (this.variaveis().some(v => v.origem === 'fixo' && !v.valorFixo.trim())) {
      this.response.set('❌ Preencha o que entra em cada campo variável da mensagem.');
      return;
    }
    if (alvos.length === 0) {
      this.response.set('❌ Marque pelo menos um contato para o agendamento.');
      return;
    }
    if (!empId) {
      this.response.set('❌ Sessão expirada. Faça login novamente.');
      return;
    }

    const contatoIds = alvos.map(c => c.id);
    const dataInicio = `${f.dataInicio}T00:00:00`;
    const dataFim = f.dataFim ? `${f.dataFim}T23:59:59` : null;
    const variaveis = this.variaveis();

    this.salvando.set(true);

    const request = this.editingId()
      ? this.agendamentoService.atualizar({
          id: this.editingId(),
          nome: f.nome.trim(),
          templateId: f.templateId,
          tipoRecorrencia: f.tipoRecorrencia,
          dataInicio,
          dataFim,
          dataReferencia: f.dataReferencia,
          contatoIds,
          variaveis,
        })
      : this.agendamentoService.incluir({
          empresaId: empId,
          nome: f.nome.trim(),
          templateId: f.templateId,
          tipoRecorrencia: f.tipoRecorrencia,
          dataInicio,
          dataFim,
          dataReferencia: f.dataReferencia,
          contatoIds,
          usuarioCriacaoId: this.userId(),
          variaveis,
        });

    request.subscribe({
      next: () => {
        this.salvando.set(false);
        this.response.set('✅ Agendamento salvo com sucesso!');
        this.cancelarEdicao();
        this.buscarAgendamentos();
      },
      error: (err) => {
        this.salvando.set(false);
        this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao salvar o agendamento.')}`);
      }
    });
  }

  prepararEdicao(a: Agendamento) {
    this.agendamentoService.obter(a.id).subscribe({
      next: (detalhe) => {
        this.editingId.set(detalhe.id);
        this.form.set({
          nome: detalhe.nome,
          templateId: detalhe.templateId,
          tipoRecorrencia: detalhe.tipoRecorrencia,
          dataInicio: paraDataCurta(detalhe.dataInicio),
          dataFim: detalhe.dataFim ? paraDataCurta(detalhe.dataFim) : '',
          dataReferencia: paraDatetimeLocal(detalhe.dataReferencia),
        });
        this.variaveis.set(detalhe.variaveis || []);
        this.contatos.update(list => list.map(c => ({ ...c, checked: detalhe.contatoIds.includes(c.id) })));
        this.response.set('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao carregar o agendamento.')}`)
    });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({ nome: '', templateId: '', tipoRecorrencia: 'DIARIA', dataInicio: '', dataFim: '', dataReferencia: '' });
    this.variaveis.set([]);
    this.contatos.update(list => list.map(c => ({ ...c, checked: false })));
  }

  pausarRetomar(a: Agendamento) {
    this.agendamentoService.alterarStatus(a.id, !a.ativo).subscribe({
      next: () => {
        this.response.set(a.ativo ? '⏸ Agendamento pausado.' : '▶ Agendamento retomado.');
        this.buscarAgendamentos();
      },
      error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao alterar o agendamento.')}`)
    });
  }

  excluir(a: Agendamento) {
    if (!confirm(`Excluir o agendamento "${a.nome}"? Essa ação não pode ser desfeita.`)) return;

    this.agendamentoService.excluir(a.id).subscribe({
      next: () => {
        this.agendamentos.update(lista => lista.filter(x => x.id !== a.id));
        this.response.set('✅ Agendamento excluído.');
        if (this.historicoAbertoId() === a.id) this.historicoAbertoId.set(null);
      },
      error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao excluir o agendamento.')}`)
    });
  }

  toggleHistorico(a: Agendamento) {
    if (this.historicoAbertoId() === a.id) {
      this.historicoAbertoId.set(null);
      return;
    }

    this.historicoAbertoId.set(a.id);
    this.carregandoHistorico.set(true);
    this.execucoes.set([]);

    this.agendamentoService.listarExecucoes(a.id).subscribe({
      next: (res) => {
        this.execucoes.set(res);
        this.carregandoHistorico.set(false);
      },
      error: (err) => {
        this.carregandoHistorico.set(false);
        this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao carregar o histórico.')}`);
      }
    });
  }
}

// "2026-09-20T14:30:00" (o que a API devolve) -> "2026-09-20T14:30" (o que <input type="datetime-local"> aceita)
function paraDatetimeLocal(iso: string): string {
  return iso?.slice(0, 16) || '';
}

// "2026-09-20T23:59:59" -> "2026-09-20" (o que <input type="date"> aceita)
function paraDataCurta(iso: string): string {
  return iso?.slice(0, 10) || '';
}
