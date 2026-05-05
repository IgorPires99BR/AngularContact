import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';

interface Contato {
  id?: string;
  usuarioId: string;
  telefone: string;
  nome?: string;
  email?: string;
  dataCriacao?: string;
}

@Component({
  selector: 'app-contatos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contatos.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class ContatosComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Signal reativo que vem do AuthService
  private userId = this.authService.usuarioIdSignal;

  private readonly API_URL = 'https://localhost:7118/api/contato';

  // Form sem o campo usuarioId, pois será injetado logicamente
  form = signal({
    nome: '',
    telefone: '',
    email: '',
  });

  search = signal('');
  editingId = signal<string | null>(null);
  response = signal('');
  contatos = signal<Contato[]>([]);

  ngOnInit() {
    this.buscar();
  }

  update(field: string, value: string) {
    this.form.set({ ...this.form(), [field]: value });
  }

  buscar() {
    const id = this.userId();

    if (!id) {
      this.response.set('⚠ Usuário não identificado no sistema.');
      return;
    }

    this.http.get<Contato[]>(`${this.API_URL}/obter-por-usuario/${id}`)
      .subscribe({
        next: (res) => {
          this.contatos.set(res);
          this.response.set(res.length > 0 ? `✅ ${res.length} contatos encontrados` : '⚠ Nenhum contato.');
        },
        error: (err) => {
          console.error(err);
          this.response.set('❌ Erro na requisição. Verifique o console.');
        }
      });
  }

  incluir() {
    const f = this.form();
    const currentUserId = this.userId();

    // Validação básica
    if (!f.telefone) {
      this.response.set('❌ O telefone é obrigatório');
      return;
    }

    if (!currentUserId) {
      this.response.set('❌ Sessão expirada. Faça login novamente.');
      return;
    }

    // Monta o objeto final injetando o usuarioId do logado
    const payload: Contato = {
      ...f,
      usuarioId: currentUserId
    };

    const request = this.editingId()
      ? this.http.put(`${this.API_URL}/alterar`, { id: this.editingId(), ...payload })
      : this.http.post(`${this.API_URL}/incluir`, payload);

    request.subscribe({
      next: () => {
        this.response.set('✅ Operação realizada!');
        this.cancelarEdicao();
        this.buscar();
      },
      error: (err) => this.response.set('❌ Erro: ' + err.message)
    });
  }

  prepararEdicao(c: Contato) {
    this.editingId.set(c.id!);
    this.form.set({
      nome: c.nome || '',
      telefone: c.telefone,
      email: c.email || ''
    });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({
      nome: '',
      telefone: '',
      email: ''
    });
  }

  excluir(id: string) {
    if (!confirm('Deseja excluir este contato?')) return;

    this.http.delete(`${this.API_URL}/excluir/${id}`).subscribe({
      next: () => {
        this.contatos.update(lista => lista.filter(c => c.id !== id));
        this.response.set('✅ Contato excluído.');
      },
      error: (err) => this.response.set('❌ Erro ao excluir: ' + err.message)
    });
  }
}
