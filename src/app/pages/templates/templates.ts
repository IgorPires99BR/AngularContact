import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';
import { TemplateService } from './template.service';
import { TemplateHeaderEditorComponent } from './template-header-editor/template-header-editor';
import { TemplateBodyEditorComponent } from './template-body-editor/template-body-editor';
import { TemplateFooterEditorComponent } from './template-footer-editor/template-footer-editor';
import { TemplateBotoesEditorComponent } from './template-botoes-editor/template-botoes-editor';
import { TemplatePreviewComponent } from './template-preview/template-preview';
import {
  Template,
  TemplateBotaoForm,
  HeaderState,
  headerStateVazio,
  parseComponentes,
  IDIOMAS_META,
  STATUS_EDITAVEIS,
  TIPO_BOTAO_POR_INDICE,
} from './template.models';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TemplateHeaderEditorComponent,
    TemplateBodyEditorComponent,
    TemplateFooterEditorComponent,
    TemplateBotoesEditorComponent,
    TemplatePreviewComponent,
  ],
  templateUrl: './templates.html',
  styleUrls: ['../shared-crud.css', './templates.css']
})
export class TemplatesComponent implements OnInit {
  private templateService = inject(TemplateService);
  private authService = inject(AuthService);

  private empresaId = this.authService.empresaIdSignal;
  empresaIdAtual = computed(() => this.empresaId());

  idiomas = IDIOMAS_META;

  form = signal({
    nomeTemplate: '',
    categoria: 'UTILITY',
    idioma: 'pt_BR',
    conteudo: ''
  });

  botoes = signal<TemplateBotaoForm[]>([]);
  headerState = signal<HeaderState>(headerStateVazio());
  footerTexto = signal('');
  exemplosBody = signal<{ value: string }[]>([]);
  uploadingHeader = signal(false);

  response = signal('');
  templates = signal<Template[]>([]);
  sincronizando = signal(false);
  search = signal('');

  // Template em edição (null = formulário está em modo criação)
  modoEdicao = signal<Template | null>(null);

  templatesFiltrados = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.templates();
    return this.templates().filter(t =>
      t.nomeTemplate?.toLowerCase().includes(termo) ||
      t.categoria?.toLowerCase().includes(termo) ||
      t.status?.toLowerCase().includes(termo)
    );
  });

  aprovados = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'APPROVED').length);
  pendentes = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'PENDING').length);
  rejeitados = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'REJECTED' || t.status?.toUpperCase() === 'REJECTED_META').length);

  // Prévia do corpo da mensagem com variáveis {{1}}, {{2}} preenchidas pelos exemplos digitados
  preview = computed(() => {
    const conteudo = this.form().conteudo;
    if (!conteudo) return '';
    const exemplos = this.exemplosBody();
    let i = 0;
    return conteudo.replace(/\{\{\d+\}\}/g, () => {
      const valor = exemplos[i]?.value?.trim();
      i++;
      return valor || `[Exemplo ${i}]`;
    });
  });

  ngOnInit() {
    this.buscar();
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  buscar() {
    const empId = this.empresaId();
    if (!empId) return;

    this.templateService.listar(empId).subscribe({
      next: (res) => this.templates.set(res),
      error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao buscar templates locais.')}`)
    });
  }

  salvar() {
    const f = this.form();
    const empId = this.empresaId();
    const editando = this.modoEdicao();

    if (!f.nomeTemplate || !f.conteudo || !empId) {
      this.response.set('❌ Preencha os campos obrigatórios (Nome e Conteúdo).');
      return;
    }

    const header = this.headerState();
    if (header.tipo === 'TEXT' && !header.texto.trim()) {
      this.response.set('❌ Informe o texto do cabeçalho.');
      return;
    }
    if ((header.tipo === 'IMAGE' || header.tipo === 'VIDEO' || header.tipo === 'DOCUMENT') && !header.exemploHandle) {
      this.response.set('❌ Envie o arquivo de exemplo do cabeçalho antes de cadastrar o template.');
      return;
    }

    const exemplos = this.exemplosBody().map(e => e.value.trim());
    if (exemplos.length > 0 && exemplos.some(e => !e)) {
      this.response.set('❌ Preencha um valor de exemplo para cada variável {{n}} do corpo.');
      return;
    }

    const botoesPayload = this.botoes().map(b => ({
      tipo: b.tipo,
      texto: b.texto,
      url: b.url,
      numeroTelefone: b.numeroTelefone,
      codigoExemplo: b.codigoExemplo
    }));

    const componentesPayload = {
      categoria: f.categoria,
      conteudo: f.conteudo,
      botoes: botoesPayload.length > 0 ? botoesPayload : null,
      headerTipo: header.tipo === 'NONE' ? null : header.tipo,
      headerTexto: header.tipo === 'TEXT' ? header.texto.trim() : null,
      headerExemploHandle: (header.tipo === 'IMAGE' || header.tipo === 'VIDEO' || header.tipo === 'DOCUMENT') ? header.exemploHandle : null,
      footerTexto: this.footerTexto().trim() || null,
      exemplosBody: exemplos.length > 0 ? exemplos : null
    };

    if (editando) {
      this.response.set('⏳ Salvando alterações na Meta...');
      this.templateService.atualizar(editando.id, componentesPayload).subscribe({
        next: () => {
          this.response.set('✅ Template atualizado e reenviado para análise da Meta!');
          this.cancelarEdicao();
          this.buscar();
        },
        error: (err) => {
          this.response.set(`❌ Erro: ${extrairMensagemErro(err, 'Não foi possível salvar as alterações.')}`);
        }
      });
      return;
    }

    // Força o nome a seguir o padrão estrito de snake_case exigido pela Meta
    const nomeTratado = f.nomeTemplate.trim().toLowerCase().replace(/\s+/g, '_');

    const payload = {
      idEmpresa: empId,
      nomeTemplate: nomeTratado,
      idioma: f.idioma,
      ...componentesPayload
    };

    this.response.set('⏳ Registrando template no ecossistema da Meta...');

    this.templateService.incluir(payload).subscribe({
      next: () => {
        this.response.set('✅ Template enviado com sucesso para análise da Meta e salvo localmente!');
        this.limparForm();
        this.buscar();
      },
      error: (err) => {
        this.response.set(`❌ Erro: ${extrairMensagemErro(err, 'Não foi possível salvar.')}`);
      }
    });
  }

  sincronizarComMeta() {
    const empId = this.empresaId();
    if (!empId) return;

    this.sincronizando.set(true);
    this.response.set('⏳ Buscando atualizações e sincronizando com o WABA...');

    this.templateService.sincronizarComMeta(empId).subscribe({
      next: () => {
        this.response.set('✅ Painel de templates atualizado com a Meta!');
        this.sincronizando.set(false);
        this.buscar();
      },
      error: (err) => {
        this.response.set(`❌ Falha ao sincronizar: ${extrairMensagemErro(err, 'Falha ao processar sincronização via PUT.')}`);
        this.sincronizando.set(false);
      }
    });
  }

  podeEditar(t: Template): boolean {
    return STATUS_EDITAVEIS.includes((t.status || '').toUpperCase());
  }

  iniciarEdicao(t: Template) {
    if (!this.podeEditar(t)) return;

    const componentes = parseComponentes(t.componentesJson);
    const headerComp = componentes.find(c => c.Tipo === 0);
    const footerComp = componentes.find(c => c.Tipo === 2);
    const botoesComp = componentes.find(c => c.Tipo === 3);

    this.form.set({
      nomeTemplate: t.nomeTemplate,
      categoria: t.categoria,
      idioma: t.idioma,
      conteudo: t.conteudo
    });

    if (headerComp) {
      const tipoPorFormat: HeaderState['tipo'][] = ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'];
      this.headerState.set({
        tipo: tipoPorFormat[headerComp.FormatMidia] ?? 'NONE',
        texto: headerComp.Texto || '',
        exemploHandle: '',
        exemploNomeArquivo: ''
      });
    } else {
      this.headerState.set(headerStateVazio());
    }

    this.footerTexto.set(footerComp?.Texto || '');

    this.botoes.set((botoesComp?.Botoes || []).map(b => ({
      tipo: TIPO_BOTAO_POR_INDICE[b.Tipo] ?? 'QUICK_REPLY',
      texto: b.Texto,
      url: b.Url,
      numeroTelefone: b.NumeroTelefone,
      codigoExemplo: b.CodigoExemplo
    })));

    const quantidadeVariaveis = (t.conteudo.match(/\{\{\d+\}\}/g) || []).length;
    this.exemplosBody.set(Array.from({ length: quantidadeVariaveis }, () => ({ value: '' })));

    this.modoEdicao.set(t);
    this.response.set('');
  }

  cancelarEdicao() {
    this.modoEdicao.set(null);
    this.limparForm();
  }

  excluir(id: string) {
    if (!confirm('Tem certeza que deseja excluir este template? Isso remove o template da Meta (todas as variantes de idioma desse nome) e do cadastro local.')) {
      return;
    }

    this.templateService.excluir(id).subscribe({
      next: () => {
        this.response.set('✅ Template excluído.');
        this.templates.update(list => list.filter(t => t.id !== id));
      },
      error: (err) => {
        this.response.set(`❌ Erro ao excluir: ${extrairMensagemErro(err, 'Não foi possível excluir o template.')}`);
      }
    });
  }

  private limparForm() {
    this.form.set({
      nomeTemplate: '',
      categoria: 'UTILITY',
      idioma: 'pt_BR',
      conteudo: ''
    });
    this.botoes.set([]);
    this.headerState.set(headerStateVazio());
    this.footerTexto.set('');
    this.exemplosBody.set([]);
  }

  badgeClass(status?: string) {
    if (!status) return 'badge-warn';
    const s = status.toUpperCase();
    if (s === 'APPROVED' || s === 'APPROVED_META') return 'badge-green';
    if (s === 'PENDING') return 'badge-warn';
    return 'badge-danger'; // REJECTED
  }

  // Extrai os botões salvos (ComponentesJson) de um template da lista, pra exibir no preview
  botoesDoTemplate(t: Template): TemplateBotaoForm[] {
    const componentes = parseComponentes(t.componentesJson);
    const componenteBotoes = componentes.find(c => c.Tipo === 3);
    return (componenteBotoes?.Botoes || []).map(b => ({
      tipo: TIPO_BOTAO_POR_INDICE[b.Tipo] ?? 'QUICK_REPLY',
      texto: b.Texto,
      url: b.Url,
      numeroTelefone: b.NumeroTelefone,
      codigoExemplo: b.CodigoExemplo
    }));
  }
}
