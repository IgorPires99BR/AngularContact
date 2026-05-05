import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

// Interface ajustada exatamente ao JSON da imagem image_66870d.png
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
  private readonly API_URL = 'https://localhost:7118/api/contato'; // URL da imagem

  form = signal({
    nome: '',
    telefone: '',
    email: '',
    usuarioId: ''
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
    const term = this.search();

    // Usando a URL completa da imagem para garantir o teste
    this.http.get<Contato[]>(`${this.API_URL}/obter-por-usuario/255BECF9-4249-4F2C-B3E7-BD79C05E8D37`)
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
    if (!f.telefone || !f.usuarioId) {
      this.response.set('❌ Telefone e UsuárioID são obrigatórios');
      return;
    }

    const request = this.editingId()
      ? this.http.put(`${this.API_URL}/alterar`, { id: this.editingId(), ...f })
      : this.http.post(`${this.API_URL}/incluir`, f);

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
      email: c.email || '',
      usuarioId: c.usuarioId
    });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({ nome: '', telefone: '', email: '', usuarioId: '' });
  }

  excluir(id: string) {
    if (!confirm('Deseja excluir?')) return;
    this.http.delete(`${this.API_URL}/excluir/${id}`).subscribe(() => {
      this.contatos.set(this.contatos().filter(c => c.id !== id));
    });
  }
}
