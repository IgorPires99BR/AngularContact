import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

interface Contato {
  id: string;
  nome?: string;
  telefone: string;
  email?: string;
  checked?: boolean;
}

interface NumeroMeta {
  id: string;
  usuarioId: string;
  telefone: string;
  descricao: string;
  instanciaId: string;
  statusMeta: string | null;
  qualidadeMeta: string | null;
  dataCriacao: string;
}

// Interface corrigida para mapear com o payload real do banco
interface TemplateMeta {
  id: string;
  empresaId: string;
  nomeTemplate: string; // antes era 'nome'
  conteudo: string;     // antes era 'bodyOriginal'
  categoria: string;
  idioma: string;
  status: string;
  dataCriacao?: string;
}

@Component({
  selector: 'app-disparador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './disparador.component.html',
  styleUrls: ['../shared-crud.css', './disparador.component.css'],
})
export class DisparadorComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly API_CONTATO = `${environment.apiUrl}/contato`;
  private readonly API_NUMERO = `${environment.apiUrl}/numero`;
  private readonly API_DISPARO = `${environment.apiUrl}/disparador`;
  private readonly API_TEMPLATE = `${environment.apiUrl}/template`;

  private empresaId = this.authService.empresaIdSignal;
  private userId = this.authService.usuarioIdSignal;

  // Signals de Estado
  contatos = signal<Contato[]>([]);
  templates = signal<TemplateMeta[]>([]);
  numerosAtivos = signal<NumeroMeta[]>([]);
  search = signal('');

  form = signal({
    templateId: '',
    instanciaId: '',
  });

  params = signal<{ value: string }[]>([]);
  response = signal('');

  // Computeds
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

  // Preview dinâmico mapeando a propriedade correta (conteudo)
  templatePreview = computed(() => {
    const tplId = this.form().templateId;
    const tpl = this.templates().find(t => t.id === tplId);
    if (!tpl) return 'Selecione um template para visualizar o preview...';

    let textoFormatado = tpl.conteudo; // Ajustado de bodyOriginal para conteudo
    this.params().forEach((p, index) => {
      const valorSubstitutos = p.value.trim() ? p.value : `[Parâmetro ${index + 1}]`;
      const regex = new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g');
      textoFormatado = textoFormatado.replace(regex, valorSubstitutos);
    });

    return textoFormatado;
  });

  ngOnInit() {
    this.buscarContatos();
    this.buscarTemplates();
    this.buscarNumeros();
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

  buscarTemplates() {
    const empId = this.empresaId();
    if (!empId) return;

    this.http.get<TemplateMeta[]>(`${this.API_TEMPLATE}/Listar/${empId}`)
      .subscribe({
        next: (res) => {
          // Filtra trazendo apenas os homologados (APPROVED) para segurança do disparo
          const aprovados = res.filter(t => t.status?.toUpperCase() === 'APPROVED');
          this.templates.set(aprovados);
        },
        error: () => this.response.set('❌ Erro ao carregar templates.')
      });
  }

  buscarNumeros() {
    const uid = this.userId();
    if (!uid) return;

    this.http.get<NumeroMeta[]>(`${this.API_NUMERO}/ListarNumeros/${uid}`)
      .subscribe({
        next: (res) => {
          // Removeu o filtro de 'CONNECTED' para listar o seu número de teste (que vem com statusMeta: null)
          this.numerosAtivos.set(res);
        },
        error: () => this.response.set('❌ Erro ao carregar canais/números.')
      });
  }

  onTemplateChange(id: string) {
    this.updateForm('templateId', id);
    const tpl = this.templates().find(t => t.id === id);
    if (tpl) {
      // Mapeia os matches em cima da propriedade 'conteudo'
      const matches = tpl.conteudo.match(/\{\{\d+\}\}/g) || [];
      this.params.set(matches.map(() => ({ value: '' })));
    } else {
      this.params.set([]);
    }
  }

  updateForm(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  updateParam(index: number, val: string) {
    const p = [...this.params()];
    p[index] = { value: val };
    this.params.set(p);
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

  disparar() {
    if (!this.form().instanciaId) {
      this.response.set('❌ Selecione um número ativo (Instância).');
      return;
    }
    const tplId = this.form().templateId;
    const templateSelecionado = this.templates().find(t => t.id === tplId);

    if (!templateSelecionado) {
      this.response.set('❌ Selecione um template de mensagem válido.');
      return;
    }
    if (this.selecionados().length === 0) {
      this.response.set('❌ Selecione ao menos um contato na tabela.');
      return;
    }

    // Montando o payload com a estrutura exata exigida pelo Swagger da Contact Solution
    const payload = {
      telefones: this.selecionados().map(c => c.telefone),
      nomeTemplate: templateSelecionado.nomeTemplate,
      idioma: templateSelecionado.idioma,
      parametrosBody: this.params().map(p => p.value),
      parametrosButton: [] // Se não usar variáveis em botões por enquanto, enviamos vazio
    };

    this.response.set('⏳ Iniciando envio em lote...');

    // Ajustado a rota para bater com o Swagger: /disparador/EnviarMensagemTemplateLote
    this.http.post(`${this.API_DISPARO}/EnviarMensagemTemplateLote`, payload).subscribe({
      next: (res: any) => {
        // Aproveitando que o Result devolve um sumário do lote:
        const total = res?.data?.totalProcessado ?? payload.telefones.length;
        const sucesso = res?.data?.totalSucesso ?? total;

        this.response.set(`✅ Disparo concluído! Sucesso: ${sucesso} de ${total}.`);
        this.params.set([]);
        this.updateForm('templateId', '');
        this.contatos.update(list => list.map(c => ({ ...c, checked: false })));
      },
      error: (err) => {
        console.error(err);
        this.response.set(`❌ Falha: ${err.error?.message || 'Erro ao processar lote na API'}`);
      }
    });
  }
}
