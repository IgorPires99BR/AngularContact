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
  accessToken?: string;   // Mapeado de MetaAccessToken
  wabaId?: string;        // Mapeado de WabaId
  phoneNumberId?: string; // Mapeado de PhoneNumberId
  dataCriacao: string;
  planoId?: string;
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
  // DEPOIS (Correto):
  form = signal({
    nome: '',
    cnpj: '',
    email: '',
    tel: '',
    metaAccessToken: '',
    planoId: '',
    wabaId: '',
    phoneNumberId: '' // <-- ADICIONE ESTA LINHA
  });
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
      metaAccessToken: empresa.accessToken || '', // Garanta que o mapeamento do token está batendo com o que vem da API
      planoId: empresa.planoId || '',
      wabaId: empresa.wabaId || '',
      phoneNumberId: empresa.phoneNumberId || '' // <-- ADICIONE ESTA LINHA
    });
    this.response.set(`Editando: ${empresa.nome}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({ nome: '', cnpj: '', email: '', tel: '', metaAccessToken: '', planoId: '', wabaId: '', phoneNumberId: '' });
    this.response.set('');
  }

  salvar() {
    const f = this.form();
    if (!f.nome || !f.cnpj) {
      this.response.set('❌ Nome e CNPJ são obrigatórios');
      return;
    }

    // Payload unificado contendo as propriedades digitadas
    const payload: any = {
      nome: f.nome,
      email: f.email,
      telefone: f.tel,
      cnpj: f.cnpj,
      planoId: f.planoId,
      wabaId: f.wabaId,
      phoneNumberId: f.phoneNumberId
    };

    if (this.editingId()) {
      payload.id = this.editingId();
      payload.accessToken = f.metaAccessToken; // Mapeia para alterar

      this.http.put(`${this.BASE_URL}/alterar`, payload).subscribe({
        next: () => {
          this.response.set('✅ Empresa atualizada com sucesso!');
          this.cancelarEdicao();
          this.obterEmpresas();
        },
        error: () => this.response.set('❌ Erro ao atualizar empresa.')
      });
    } else { // <-- AGORA SIM! Adicionado o else correto
      payload.accessToken = f.metaAccessToken; // Mapeia Corretamente para incluir

      this.http.post(`${this.BASE_URL}/incluir`, payload).subscribe({
        next: () => {
          this.response.set('✅ Empresa cadastrada com sucesso!');
          this.cancelarEdicao();
          this.obterEmpresas();
        },
        error: () => this.response.set('❌ Falha ao salvar empresa.')
      });
    }
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
