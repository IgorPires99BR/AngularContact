import { Component, Input, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { isEmailValido } from '../../shared/utils/validators';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

type Perfil = 'admin' | 'operador';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  empresaId: string;
  perfil: Perfil;
  criadoEm: string;
  // Estrutura de acesso modular (Perfil/PerfilTela) -- nao confundir com o campo "perfil"
  // acima (admin/operador). Nulo = sem perfil de acesso atribuido (comportamento legado).
  perfilId?: string | null;
  // So vem preenchido na listagem "todas as empresas" (ver [todasAsEmpresas]) -- dado de
  // outra empresa, so a conta de plataforma chega nesse modo.
  nomeEmpresa?: string | null;
}

// Estrutura de acesso modular: um PerfilAcesso agrupa quais telas do menu um grupo de
// usuarios enxerga. Nao confundir com o campo "perfil" (admin/operador) do Usuario.
interface PerfilAcesso {
  id: string;
  nome: string;
  telas: string[];
}

// Gerencia os usuarios de UMA empresa (a definida por [empresaId]). Extraido do que era a tela
// de Usuarios inteira, que so sabia mexer na empresa de quem estava logado -- isso deixava a
// conta de plataforma (Contact Solution, que administra os clientes) sem nenhum jeito de
// cadastrar um usuario ou definir uma senha em QUALQUER empresa cliente. O backend ja aceitava
// isso (CriaUsuarioHandler: "empresa vem do escopo do token, null so pra conta de plataforma,
// que pode criar usuario em qualquer empresa"); faltava a tela deixar escolher a empresa.
//
// Agora esta logica mora aqui, parametrizada por empresaId, e e usada em dois lugares:
// - UsuariosComponent (rota /usuarios): passa a propria empresa de quem esta logado, mesmo
//   comportamento de sempre pra quem administra so a propria conta.
// - EmpresasComponent: a conta de plataforma abre isto dentro da linha de qualquer empresa,
//   pra cadastrar e editar (inclusive a senha) o time daquele cliente sem sair da tela.
@Component({
  selector: 'app-usuarios-da-empresa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios-da-empresa.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class UsuariosDaEmpresaComponent implements OnInit {
  // Um dos dois precisa vir preenchido: empresaId pra administrar UMA empresa, ou
  // todasAsEmpresas pra conta de plataforma ver o time de todo mundo numa lista so.
  @Input() empresaId?: string;
  @Input() todasAsEmpresas = false;

  private http = inject(HttpClient);
  private readonly BASE_URL = `${environment.apiUrl}/usuario`;
  private readonly PERFIL_URL = `${environment.apiUrl}/perfil`;

  form = signal({
    nome: '',
    email: '',
    senhaHash: '',
    perfil: 'operador' as Perfil,
    perfilId: '' as string | null
  });

  response = signal('');
  usuarios = signal<Usuario[]>([]);
  editingId = signal<number | null>(null);
  // So usado no modo "todas as empresas": qual empresa o usuario em edicao pertence, ja que
  // nesse modo nao ha um [empresaId] fixo pra assumir (ver prepararEdicao/incluir).
  private editingEmpresaId = signal<string | null>(null);
  search = signal('');
  carregando = signal(false);

  usuariosFiltrados = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.usuarios();
    return this.usuarios().filter(u =>
      u.nome?.toLowerCase().includes(termo) ||
      u.email?.toLowerCase().includes(termo) ||
      u.perfil?.toLowerCase().includes(termo) ||
      u.nomeEmpresa?.toLowerCase().includes(termo)
    );
  });

  // Perfis de acesso (estrutura modular) cadastrados nesta empresa -- geridos na tela
  // dedicada /perfis (PerfisComponent). Aqui so lista, pra alimentar o select abaixo.
  perfisAcesso = signal<PerfilAcesso[]>([]);

  ngOnInit() {
    this.listar();
    this.listarPerfis();
  }

  listarPerfis() {
    // No modo "todas as empresas" nao ha uma unica empresa pra listar perfis (e por isso
    // que o formulario de criar usuario fica escondido nesse modo, ver template).
    if (!this.empresaId || this.todasAsEmpresas) return;
    this.http.get<PerfilAcesso[]>(`${this.PERFIL_URL}/obter-por-empresa`).subscribe({
      next: (dados) => this.perfisAcesso.set(dados),
      error: () => this.perfisAcesso.set([]),
    });
  }

  nomeDoPerfilAcesso(perfilId: string | null | undefined): string {
    if (!perfilId) return '—';
    return this.perfisAcesso().find(p => p.id === perfilId)?.nome ?? '—';
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  listar() {
    if (!this.todasAsEmpresas && !this.empresaId) return;

    const url = this.todasAsEmpresas
      ? `${this.BASE_URL}/obter-todos`
      : `${this.BASE_URL}/obter-por-empresa/${this.empresaId}`;

    this.carregando.set(true);
    this.http.get<Usuario[]>(url).subscribe({
      next: (dados) => { this.usuarios.set(dados); this.carregando.set(false); },
      error: (err) => {
        this.carregando.set(false);
        this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao listar usuários.'));
      }
    });
  }

  incluir() {
    const f = this.form();

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

    const empresaAlvo = this.todasAsEmpresas ? this.editingEmpresaId() : this.empresaId;
    const payload = { ...f, perfilId: f.perfilId || null, empresaId: empresaAlvo };

    if (this.editingId()) {
      this.http.put(`${this.BASE_URL}/alterar`, { id: this.editingId(), ...payload }).subscribe({
        next: () => {
          this.response.set('✅ Usuário atualizado!');
          this.cancelarEdicao();
          this.listar();
        },
        error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao atualizar.'))
      });
    } else {
      this.http.post(`${this.BASE_URL}/incluir`, payload).subscribe({
        next: () => {
          this.response.set(`✅ Usuário criado com sucesso!`);
          this.limparFormulario();
          this.listar();
        },
        error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao criar usuário.'))
      });
    }
  }

  prepararEdicao(u: Usuario) {
    this.editingId.set(u.id);
    this.editingEmpresaId.set(u.empresaId);
    this.form.set({
      nome: u.nome,
      email: u.email,
      senhaHash: '', // Senha geralmente não volta da API por segurança
      perfil: u.perfil,
      perfilId: u.perfilId || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicao() {
    this.limparFormulario();
  }

  private limparFormulario() {
    this.editingId.set(null);
    this.editingEmpresaId.set(null);
    this.form.set({
      nome: '',
      email: '',
      senhaHash: '',
      perfil: 'operador',
      perfilId: ''
    });
  }

  excluir(id: number) {
    if (confirm(`Excluir usuário #${id}?`)) {
      this.http.delete(`${this.BASE_URL}/excluir/${id}`).subscribe({
        next: () => {
          this.response.set('🗑️ Usuário removido.');
          this.listar();
        },
        error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao excluir.'))
      });
    }
  }

  perfilBadge(p: Perfil) {
    const classes: Record<Perfil, string> = {
      admin: 'badge-blue',
      operador: 'badge-green'
    };
    return classes[p];
  }
}
