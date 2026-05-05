import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
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
  private readonly BASE_URL = 'https://localhost:7118/api/v2/empresa';

  // Estados
  empresas = signal<Empresa[]>([]);
  form = signal({ nome: '', cnpj: '', email: '', tel: '' });
  response = signal('');
  editingId = signal<string | null>(null); // Controla se estamos editando

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

  // Preenche o formulário com os dados da linha selecionada
  prepararEdicao(empresa: Empresa) {
    this.editingId.set(empresa.id);
    this.form.set({
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      email: empresa.email,
      tel: empresa.telefone
    });
    this.response.set(`Editando: ${empresa.nome}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({ nome: '', cnpj: '', email: '', tel: '' });
    this.response.set('');
  }

  salvar() {
    const f = this.form();
    if (!f.nome || !f.cnpj) {
      this.response.set('❌ Nome e CNPJ são obrigatórios');
      return;
    }

    // Monta o payload base
    const payload: any = {
      nome: f.nome,
      email: f.email,
      telefone: f.tel,
      cnpj: f.cnpj
    };

    if (this.editingId()) {
      // --- LÓGICA DE EDIÇÃO (PUT) ---
      payload.id = this.editingId(); // Inclui o ID conforme exigido pela API /alterar

      this.http.put(`${this.BASE_URL}/alterar`, payload).subscribe({
        next: () => {
          this.response.set('✅ Empresa atualizada com sucesso!');
          this.cancelarEdicao();
          this.obterEmpresas();
        },
        error: () => this.response.set('❌ Erro ao atualizar empresa.')
      });
    } else {
      // --- LÓGICA DE INCLUSÃO (POST) ---
      this.http.post(`${this.BASE_URL}/incluir`, payload).subscribe({
        next: () => {
          this.response.set('✅ Empresa cadastrada com sucesso!');
          this.form.set({ nome: '', cnpj: '', email: '', tel: '' });
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
