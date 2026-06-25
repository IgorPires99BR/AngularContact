import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Empresa {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cnpj?: string;
  accessToken?: string;   // Mapeado de AccessToken (empresa.MetaAccessToken)
  wabaId?: string;        // Mapeado de WabaId
  dataCriacao: string;    // Mapeado de DataCriacao
  planoId?: string;       // ID do plano contratado
}

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './empresas.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class EmpresasComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly BASE_URL = `${environment.apiUrl}/v2/empresa`;

  empresas = signal<Empresa[]>([]);
  form = signal({ nome: '', cnpj: '', email: '', tel: '', metaAccessToken: '', planoId: '', wabaId: '' });
  response = signal('');
  editingId = signal<string | null>(null);

  ngOnInit() {
    this.obterEmpresas();
  }

  update(field: string, value: string) {
    this.form.set({ ...this.form(), [field]: value });
  }

  obterEmpresas() {
    this.http.get<Empresa[]>(`${this.BASE_URL}/obter`).subscribe({
      next: (dados) => this.empresas.set(dados),
      error: () => this.response.set('❌ Erro ao carregar empresas.')
    });
  }

  prepararEdicao(empresa: Empresa) {
    this.editingId.set(empresa.id);
    this.form.set({
      nome: empresa.nome,
      cnpj: empresa.cnpj || '',
      email: empresa.email || '',
      tel: empresa.telefone || '',
      metaAccessToken: empresa.accessToken || '',
      planoId: empresa.planoId || '',
      wabaId: empresa.wabaId || ''
    });
    this.response.set(`Editando: ${empresa.nome}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({ nome: '', cnpj: '', email: '', tel: '', metaAccessToken: '', planoId: '', wabaId: '' });
    this.response.set('');
  }

  salvar() {
    const f = this.form();
    if (!f.nome || !f.cnpj) {
      this.response.set('❌ Nome e CNPJ são obrigatórios');
      return;
    }

    const payload: any = {
      nome: f.nome,
      email: f.email,
      telefone: f.tel,
      cnpj: f.cnpj,
      planoId: f.planoId
    };

    if (this.editingId()) {
      payload.id = this.editingId();
      payload.accessToken = f.metaAccessToken;

      this.http.put(`${this.BASE_URL}/alterar`, payload).subscribe({
        next: () => {
          this.response.set('✅ Empresa atualizada com sucesso!');
          this.cancelarEdicao();
          this.obterEmpresas();
        },
        error: () => this.response.set('❌ Erro ao atualizar empresa.')
      });
    } else {
      payload.acessToken = f.metaAccessToken;

      this.http.post(`${this.BASE_URL}/incluir`, payload).subscribe({
        next: () => {
          this.response.set('✅ Empresa cadastrada com sucesso!');
          this.form.set({ nome: '', cnpj: '', email: '', tel: '', metaAccessToken: '', planoId: '', wabaId: '' });
          this.obterEmpresas();
        },
        error: () => this.response.set('❌ Falha ao salvar empresa.')
      });
    }
  }

  sincronizarWaba(empresa: Empresa) {
    if (!empresa.accessToken) {
      this.response.set('❌ Não é possível sincronizar: Empresa não possui Meta Access Token cadastrado.');
      return;
    }

    this.response.set('⏳ Sincronizando WABA com a Meta...');

    const url = `${this.BASE_URL}/atualizar-waba/${empresa.id}`;

    // Passando o token como string direta no body. 
    // Nota técnica: Se sua API continuar usando [HttpGet], mude .post para .request('GET', ...)
    this.http.post(url, JSON.stringify(empresa.accessToken), {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: () => {
        this.response.set('✅ WABA ID sincronizado e atualizado!');
        this.obterEmpresas();
      },
      error: () => this.response.set('❌ Falha ao sincronizar WABA ID na Meta.')
    });
  }

  excluir(id: string) {
    if (confirm('Deseja realmente excluir esta empresa?')) {
      this.http.delete(`${this.BASE_URL}/excluir/${id}`).subscribe({
        next: () => {
          this.response.set('🗑️ Empresa removida.');
          this.obterEmpresas();
        },
        error: () => this.response.set('❌ Erro ao excluir.')
      });
    }
  }
}
