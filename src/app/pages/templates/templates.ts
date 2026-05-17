import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

interface Template {
  id: string;
  empresaId: string;
  nomeTemplate: string;
  conteudo: string;
  categoria: string;
  idioma: string;
  status: string; // APPROVED, PENDING, REJECTED
  dataCriacao?: string;
}

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './templates.html',
  styleUrls: ['../shared-crud.css', './templates.css']
})
export class TemplatesComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // URL Base mapeada exatamente conforme a convenção da sua controller
  private readonly API_URL = `${environment.apiUrl}/template`;

  // Resgatando o Id da Empresa logada do AuthService
  private empresaId = this.authService.empresaIdSignal;
  private usuarioId = this.authService.usuarioIdSignal;

  form = signal({
    nomeTemplate: '',
    categoria: 'UTILITY',
    idioma: 'pt_BR',
    conteudo: ''
  });

  response = signal('');
  templates = signal<Template[]>([]);
  sincronizando = signal(false);

  // Contadores inteligentes baseados no status retornado pelo banco
  aprovados = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'APPROVED').length);
  pendentes = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'PENDING').length);
  rejeitados = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'REJECTED' || t.status?.toUpperCase() === 'REJECTED_META').length);

  ngOnInit() {
    this.buscar();
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  // 1. LISTAR TEMPLATES (Corrigido para api/template/Listar/{empresaId})
  buscar() {
    const empId = this.empresaId();
    if (!empId) return;

    this.http.get<Template[]>(`${this.API_URL}/Listar/${empId}`)
      .subscribe({
        next: (res) => this.templates.set(res),
        error: () => this.response.set('❌ Erro ao buscar templates locais.')
      });
  }

  // 2. INCLUIR NOVO TEMPLATE (Bate no [HttpPost("api/template/incluir")])
  incluir() {
    const f = this.form();
    const empId = this.empresaId();

    if (!f.nomeTemplate || !f.conteudo || !empId) {
      this.response.set('❌ Preencha os campos obrigatórios (Nome e Conteúdo).');
      return;
    }

    // Força o nome a seguir o padrão estrito de snake_case exigido pela Meta
    const nomeTratado = f.nomeTemplate.trim().toLowerCase().replace(/\s+/g, '_');

    const payload = {
      idEmpresa: empId,
      nomeTemplate: nomeTratado,
      categoria: f.categoria,
      idioma: f.idioma,
      conteudo: f.conteudo
    };

    this.response.set('⏳ Registrando template no ecossistema da Meta...');

    this.http.post(`${this.API_URL}/incluir`, payload).subscribe({
      next: (res: any) => {
        if (res && res.success === false) {
          this.response.set(`❌ Erro: ${res.errors?.[0]?.message || 'Falha ao processar.'}`);
          return;
        }
        this.response.set('✅ Template enviado com sucesso para análise da Meta e salvo localmente!');
        this.limparForm();
        this.buscar();
      },
      error: (err) => this.response.set(`❌ Erro: ${err.error?.message || 'Não foi possível salvar.'}`)
    });
  }

  // 3. SINCRONIZAR COM A META (Corrigido para HTTP PUT e rota AtualizaTemplateMeta/{empresaId})
  sincronizarComMeta() {
    const empId = this.empresaId();
    if (!empId) return;

    this.sincronizando.set(true);
    this.response.set('⏳ Buscando atualizações e sincronizando com o WABA...');

    // O método na controller aceita o Guid via URL e é um [HttpPut]
    this.http.put(`${this.API_URL}/AtualizaTemplateMeta/${empId}`, {}).subscribe({
      next: () => {
        this.response.set('✅ Painel de templates atualizado com a Meta!');
        this.sincronizando.set(false);
        this.buscar(); // Recarrega a grade
      },
      error: (err) => {
        console.error(err);
        this.response.set('❌ Falha ao processar sincronização via PUT.');
        this.sincronizando.set(false);
      }
    });
  }

  // Opcional: Como não há endpoint de exclusão na Controller de Templates, 
  // deixei o método preparado aqui para quando você implementar no C#.
  excluir(id: string) {
    alert('A exclusão física de templates deve ser realizada direto no painel do Facebook Business Suite para evitar multas de conformidade na Meta, ou adicione o endpoint HttpDelete correspondente na controller.');
  }

  private limparForm() {
    this.form.set({
      nomeTemplate: '',
      categoria: 'UTILITY',
      idioma: 'pt_BR',
      conteudo: ''
    });
  }

  badgeClass(status?: string) {
    if (!status) return 'badge-warn';
    const s = status.toUpperCase();
    if (s === 'APPROVED' || s === 'APPROVED_META') return 'badge-green';
    if (s === 'PENDING') return 'badge-warn';
    return 'badge-danger'; // REJECTED
  }
}
