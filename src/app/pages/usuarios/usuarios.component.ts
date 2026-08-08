import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { isEmailValido } from '../../shared/utils/validators';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

type Perfil = 'admin' | 'operador' | 'viewer';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  empresaId: string;
  perfil: Perfil;
  criadoEm: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class UsuariosComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly BASE_URL = `${environment.apiUrl}/usuario`;

  // Obtemos o ID da empresa do Signal computado no AuthService
  private empresaIdLogada = computed(() => this.authService.user()?.idEmpresa);

  form = signal({
    nome: '',
    email: '',
    senhaHash: '',
    perfil: 'admin' as Perfil
  });

  response = signal('');
  usuarios = signal<Usuario[]>([]);
  editingId = signal<number | null>(null);
  search = signal('');

  usuariosFiltrados = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.usuarios();
    return this.usuarios().filter(u =>
      u.nome?.toLowerCase().includes(termo) ||
      u.email?.toLowerCase().includes(termo) ||
      u.perfil?.toLowerCase().includes(termo)
    );
  });

  ngOnInit() {
    this.listarPorEmpresa();
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  // --- Ações de API ---

  listarPorEmpresa() {
    const eid = this.empresaIdLogada();
    if (!eid) return;

    // Ajustado para o endpoint que filtra por empresa
    this.http.get<Usuario[]>(`${this.BASE_URL}/obter-por-empresa/${eid}`).subscribe({
      next: (dados) => this.usuarios.set(dados),
      error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao listar usuários da empresa.'))
    });
  }

  incluir() {
    const f = this.form();
    const eid = this.empresaIdLogada();

    if (!f.nome || !f.email || (!this.editingId() && !f.senhaHash)) {
      this.response.set('❌ Nome, E-mail e Senha são obrigatórios');
      return;
    }

    if (!isEmailValido(f.email)) {
      this.response.set('❌ E-mail inválido.');
      return;
    }

    if (!this.editingId() && f.senhaHash.length < 6) {
      this.response.set('❌ A senha deve ter ao menos 6 caracteres.');
      return;
    }

    // Injeta o empresaId no payload silenciosamente
    const payload = {
      ...f,
      empresaId: eid
    };

    if (this.editingId()) {
      this.http.put(`${this.BASE_URL}/alterar`, { id: this.editingId(), ...payload }).subscribe({
        next: () => {
          this.response.set('✅ Usuário atualizado!');
          this.cancelarEdicao();
          this.listarPorEmpresa();
        },
        error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao atualizar.'))
      });
    } else {
      this.http.post(`${this.BASE_URL}/incluir`, payload).subscribe({
        next: () => {
          this.response.set(`✅ Usuário criado com sucesso!`);
          this.limparFormulario();
          this.listarPorEmpresa();
        },
        error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao criar usuário.'))
      });
    }
  }

  prepararEdicao(u: Usuario) {
    this.editingId.set(u.id);
    this.form.set({
      nome: u.nome,
      email: u.email,
      senhaHash: '', // Senha geralmente não volta da API por segurança
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
      perfil: 'admin'
    });
  }

  excluir(id: number) {
    if (confirm(`Excluir usuário #${id}?`)) {
      this.http.delete(`${this.BASE_URL}/excluir/${id}`).subscribe({
        next: () => {
          this.response.set('🗑️ Usuário removido.');
          this.listarPorEmpresa();
        },
        error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao excluir.'))
      });
    }
  }

  perfilBadge(p: Perfil) {
    const classes: Record<Perfil, string> = {
      admin: 'badge-blue',
      operador: 'badge-green',
      viewer: 'badge-muted'
    };
    return classes[p];
  }
}
