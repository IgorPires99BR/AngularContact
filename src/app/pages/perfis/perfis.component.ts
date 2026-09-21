import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';
import { TELAS_DISPONIVEIS } from '../../shared/menu';

// Estrutura de acesso modular: um Perfil agrupa quais telas do menu um grupo de usuarios
// enxerga. Nao confundir com o campo "Perfil" (admin/operador) do Usuario -- este e o Id
// atribuido em Usuario.PerfilId (ver usuarios-da-empresa.component.ts, onde o usuario
// escolhe um destes perfis num select).
interface PerfilAcesso {
  id: string;
  empresaId: string;
  nome: string;
  telas: string[];
}

interface EmpresaResumo {
  id: string;
  nome: string;
}

// Tela exclusiva da conta de plataforma (ver platformAdminGuard): quem revende a
// plataforma decide os perfis de acesso de CADA empresa cliente, nao cada empresa por si --
// por isso o formulario pede pra escolher a empresa (o backend ja devolve os perfis de
// todas de uma vez pra conta de plataforma, ver PerfisController.ObterPorEmpresa).
@Component({
  selector: 'app-perfis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfis.component.html',
  styleUrls: ['../shared-crud.css', './perfis.component.css'],
})
export class PerfisComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/perfil`;
  private readonly EMPRESA_URL = `${environment.apiUrl}/v2/empresa`;

  telasDisponiveis = TELAS_DISPONIVEIS;

  empresas = signal<EmpresaResumo[]>([]);
  perfis = signal<PerfilAcesso[]>([]);
  carregando = signal(false);
  response = signal('');
  search = signal('');
  filtroEmpresaId = signal('');

  form = signal({ nome: '', telas: [] as string[], empresaId: '' });
  editingId = signal<string | null>(null);

  perfisFiltrados = computed(() => {
    const termo = this.search().toLowerCase().trim();
    const filtroEmpresa = this.filtroEmpresaId();
    return this.perfis().filter(p =>
      (!filtroEmpresa || p.empresaId === filtroEmpresa) &&
      (!termo || p.nome.toLowerCase().includes(termo))
    );
  });

  ngOnInit() {
    this.listarEmpresas();
    this.listar();
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  toggleTela(telaId: string) {
    const atual = this.form().telas;
    const telas = atual.includes(telaId) ? atual.filter(t => t !== telaId) : [...atual, telaId];
    this.form.set({ ...this.form(), telas });
  }

  todasAsTelasMarcadas = computed(() => this.form().telas.length === this.telasDisponiveis.length);

  labelDaTela(telaId: string): string {
    return this.telasDisponiveis.find(t => t.id === telaId)?.label ?? telaId;
  }

  nomeDaEmpresa(empresaId: string): string {
    return this.empresas().find(e => e.id === empresaId)?.nome ?? '—';
  }

  marcarTodasAsTelas() {
    this.form.set({ ...this.form(), telas: this.todasAsTelasMarcadas() ? [] : this.telasDisponiveis.map(t => t.id) });
  }

  listarEmpresas() {
    this.http.get<EmpresaResumo[]>(`${this.EMPRESA_URL}/obter`).subscribe({
      next: (dados) => this.empresas.set(dados),
      error: () => this.empresas.set([]),
    });
  }

  listar() {
    this.carregando.set(true);
    // Conta de plataforma: o backend ja devolve os perfis de TODAS as empresas de uma vez
    // (EmpresaIdSolicitante nulo -- ver PerfilRepository.ObterPorEmpresa).
    this.http.get<PerfilAcesso[]>(`${this.API_URL}/obter-por-empresa`).subscribe({
      next: (dados) => {
        this.perfis.set(dados);
        this.carregando.set(false);
      },
      error: (err) => {
        this.carregando.set(false);
        this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao carregar os perfis.'));
      }
    });
  }

  salvar() {
    const f = this.form();

    if (!f.nome.trim()) {
      this.response.set('❌ Informe o nome do perfil.');
      return;
    }

    if (!f.empresaId) {
      this.response.set('❌ Escolha a empresa dona deste perfil.');
      return;
    }

    if (f.telas.length === 0) {
      this.response.set('❌ Marque pelo menos uma tela — um perfil sem telas deixa o usuário sem acesso a nada.');
      return;
    }

    const payload = { nome: f.nome, telas: f.telas, empresaId: f.empresaId };

    const request = this.editingId()
      ? this.http.put(`${this.API_URL}/alterar`, { id: this.editingId(), ...payload })
      : this.http.post(`${this.API_URL}/incluir`, payload);

    request.subscribe({
      next: () => {
        this.response.set('✅ Perfil salvo! Quem já estiver logado só vê o novo acesso no próximo login.');
        this.cancelarEdicao();
        this.listar();
      },
      error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao salvar o perfil.'))
    });
  }

  prepararEdicao(p: PerfilAcesso) {
    this.editingId.set(p.id);
    this.form.set({ nome: p.nome, telas: [...p.telas], empresaId: p.empresaId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({ nome: '', telas: [], empresaId: '' });
  }

  excluir(id: string) {
    if (!confirm('Excluir este perfil? Usuários que o usam voltam ao acesso padrão do sistema.')) return;

    this.http.delete(`${this.API_URL}/excluir/${id}`).subscribe({
      next: () => {
        this.perfis.update(lista => lista.filter(p => p.id !== id));
        this.response.set('🗑️ Perfil excluído.');
      },
      error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao excluir o perfil.'))
    });
  }
}
