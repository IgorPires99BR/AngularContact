import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

type Perfil = 'admin' | 'operador' | 'viewer';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  empresaId: string; // Atualizado de eid para empresaId
  perfil: Perfil;
  criadoEm: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class UsuariosComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly BASE_URL = 'https://localhost:7118/api/usuario';

  // Estados com os nomes de propriedades idênticos ao Payload da API
  form = signal({
    nome: '',
    email: '',
    senhaHash: '', // Atualizado de senha para senhaHash
    empresaId: '', // Atualizado de eid para empresaId
    perfil: 'admin' as Perfil
  });

  searchId = signal('');
  searchResult = signal('Aguardando consulta...');
  response = signal('');
  usuarios = signal<Usuario[]>([]);
  editingId = signal<number | null>(null);

  ngOnInit() {
    this.listarTodos();
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  // --- Ações de API ---

  listarTodos() {
    // Ajustado para um endpoint genérico de listagem, caso exista. 
    // Se precisar manter o /obter-por-id/1, basta voltar.
    this.http.get<Usuario[]>(`${this.BASE_URL}/obter-por-id/1`).subscribe({
      next: (dados) => this.usuarios.set(dados),
      error: () => this.response.set('❌ Erro ao listar usuários.')
    });
  }

  buscar() {
    const id = this.searchId();
    if (!id) { this.searchResult.set('❌ Informe um ID válido'); return; }

    this.searchResult.set('Buscando...');
    this.http.get<Usuario>(`${this.BASE_URL}/obter-por-id/${id}`).subscribe({
      next: (u) => this.searchResult.set(JSON.stringify(u, null, 2)),
      error: () => this.searchResult.set(`⚠ Usuário ${id} não encontrado`)
    });
  }

  incluir() {
    const payload = this.form();

    if (!payload.nome || !payload.email || !payload.empresaId) {
      this.response.set('❌ Nome, E-mail e Empresa ID são obrigatórios');
      return;
    }

    if (this.editingId()) {
      // EDITAR (PUT)
      this.http.put(`${this.BASE_URL}/alterar`, { id: this.editingId(), ...payload }).subscribe({
        next: () => {
          this.response.set('✅ Usuário atualizado!');
          this.cancelarEdicao();
          this.listarTodos();
        },
        error: () => this.response.set('❌ Erro ao atualizar.')
      });
    } else {
      // INCLUIR (POST)
      // O payload agora já está no formato: { empresaId, nome, email, senhaHash }
      this.http.post(`${this.BASE_URL}/incluir`, payload).subscribe({
        next: () => {
          this.response.set(`✅ Usuário criado com sucesso!`);
          this.limparFormulario();
          this.listarTodos();
        },
        error: () => this.response.set('❌ Erro ao criar usuário.')
      });
    }
  }

  prepararEdicao(u: Usuario) {
    this.editingId.set(u.id);
    this.form.set({
      nome: u.nome,
      email: u.email,
      senhaHash: '',
      empresaId: u.empresaId,
      perfil: u.perfil
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicao() {
    this.limparFormulario();
  }

  private limparFormulario() {
    this.editingId.set(null);
    this.form.set({
      nome: '',
      email: '',
      senhaHash: '',
      empresaId: '',
      perfil: 'admin'
    });
  }

  excluir(id: number) {
    if (confirm(`Excluir usuário #${id}?`)) {
      this.http.delete(`${this.BASE_URL}/excluir/${id}`).subscribe({
        next: () => {
          this.response.set('🗑️ Usuário removido.');
          this.listarTodos();
        },
        error: () => this.response.set('❌ Erro ao excluir.')
      });
    }
  }

  perfilBadge(p: Perfil) {
    return p === 'admin' ? 'badge-blue' : p === 'operador' ? 'badge-green' : 'badge-muted';
  }
}
