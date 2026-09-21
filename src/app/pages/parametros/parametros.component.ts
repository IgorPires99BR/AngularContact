import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';
import { CAMPOS_DO_CONTATO, ParametroEmpresa, TipoParametro, rotuloDoCampo } from '../../shared/variaveis/variavel-template';
import { ParametroService } from './parametro.service';

interface EmpresaResumo {
  id: string;
  nome: string;
}

// Parâmetros por empresa: valores reutilizáveis como variável de template em Disparos e
// Agendamentos. FIXO = texto que não muda (chave PIX, nome do responsável); "campo do contato"
// = puxa um dado de cada contato no envio (valor da fatura, data de vencimento...).
// A conta de plataforma escolhe de qual empresa está cadastrando; as demais ficam na própria.
@Component({
  selector: 'app-parametros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parametros.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class ParametrosComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private parametroService = inject(ParametroService);

  private readonly EMPRESA_URL = `${environment.apiUrl}/v2/empresa`;

  readonly camposDoContato = CAMPOS_DO_CONTATO;
  readonly rotuloDoCampo = rotuloDoCampo;

  ehAdminDaPlataforma = this.authService.ehAdminDaPlataforma;
  private empresaIdLogada = this.authService.empresaIdSignal;

  empresas = signal<EmpresaResumo[]>([]);
  // Empresa cujos parâmetros a tela mostra: a do usuário, ou a escolhida pela conta de plataforma.
  empresaSelecionadaId = signal('');
  parametros = signal<ParametroEmpresa[]>([]);
  carregando = signal(false);
  response = signal('');
  search = signal('');

  form = signal({ nome: '', descricao: '', tipo: 'FIXO' as TipoParametro, valor: '' });
  editingId = signal<string | null>(null);

  parametrosFiltrados = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.parametros();
    return this.parametros().filter(p =>
      p.nome.toLowerCase().includes(termo) ||
      (p.descricao ?? '').toLowerCase().includes(termo) ||
      p.valor.toLowerCase().includes(termo)
    );
  });

  ngOnInit() {
    if (this.ehAdminDaPlataforma()) {
      this.http.get<EmpresaResumo[]>(`${this.EMPRESA_URL}/obter`).subscribe({
        next: (dados) => {
          this.empresas.set(dados);
          // Começa na própria empresa da conta de plataforma, se ela estiver na lista.
          const propria = dados.find(e => e.id === this.empresaIdLogada());
          this.trocarEmpresa((propria ?? dados[0])?.id ?? '');
        },
        error: () => this.response.set('❌ Erro ao carregar as empresas.')
      });
    } else {
      this.trocarEmpresa(this.empresaIdLogada() ?? '');
    }
  }

  trocarEmpresa(empresaId: string) {
    this.empresaSelecionadaId.set(empresaId);
    this.cancelarEdicao();
    this.listar();
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  // Trocar o tipo limpa o valor: um texto fixo não é uma chave de campo válida (e vice-versa).
  trocarTipo(tipo: TipoParametro) {
    this.form.set({ ...this.form(), tipo, valor: tipo === 'CAMPO_CONTATO' ? CAMPOS_DO_CONTATO[0].chave : '' });
  }

  listar() {
    const empresaId = this.empresaSelecionadaId();
    if (!empresaId) {
      this.parametros.set([]);
      return;
    }

    this.carregando.set(true);
    this.parametroService.listar(empresaId).subscribe({
      next: (dados) => {
        this.parametros.set(dados);
        this.carregando.set(false);
      },
      error: (err) => {
        this.carregando.set(false);
        this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao carregar os parâmetros.'));
      }
    });
  }

  salvar() {
    const f = this.form();
    const empresaId = this.empresaSelecionadaId();

    if (!empresaId) {
      this.response.set('❌ Escolha a empresa dona deste parâmetro.');
      return;
    }
    if (!f.nome.trim()) {
      this.response.set('❌ Informe o nome do parâmetro.');
      return;
    }
    if (!f.valor.trim()) {
      this.response.set(f.tipo === 'FIXO' ? '❌ Informe o texto do parâmetro.' : '❌ Escolha o campo do contato.');
      return;
    }

    const payload = {
      nome: f.nome.trim(),
      descricao: f.descricao.trim() || null,
      tipo: f.tipo,
      valor: f.valor.trim(),
    };

    const request = this.editingId()
      ? this.parametroService.atualizar({ id: this.editingId(), ...payload })
      : this.parametroService.incluir({ empresaId, ...payload });

    request.subscribe({
      next: () => {
        this.response.set('✅ Parâmetro salvo!');
        this.cancelarEdicao();
        this.listar();
      },
      error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao salvar o parâmetro.'))
    });
  }

  prepararEdicao(p: ParametroEmpresa) {
    this.editingId.set(p.id);
    this.form.set({ nome: p.nome, descricao: p.descricao ?? '', tipo: p.tipo, valor: p.valor });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({ nome: '', descricao: '', tipo: 'FIXO', valor: '' });
  }

  excluir(id: string) {
    if (!confirm('Excluir este parâmetro?')) return;

    this.parametroService.excluir(id).subscribe({
      next: () => {
        this.parametros.update(lista => lista.filter(p => p.id !== id));
        this.response.set('🗑️ Parâmetro excluído.');
      },
      error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao excluir o parâmetro.'))
    });
  }

  descricaoDoValor(p: ParametroEmpresa): string {
    return p.tipo === 'CAMPO_CONTATO' ? `Campo do contato: ${rotuloDoCampo(p.valor)}` : p.valor;
  }
}
