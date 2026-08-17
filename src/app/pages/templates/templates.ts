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
import { WhatsappFormatPipe } from '../../shared/pipes/whatsapp-format.pipe';
import {
  Template,
  TemplateBotaoForm,
  HeaderState,
  headerStateVazio,
  parseComponentes,
  IDIOMAS_META,
  CODIGOS_IDIOMAS_MAIS_USADOS,
  STATUS_EDITAVEIS,
  TIPO_BOTAO_POR_INDICE,
  OBJETIVOS_TEMPLATE,
  ObjetivoTemplate,
  ObjetivoInfo,
  MODELOS_PRONTOS,
  ModeloPronto,
  gerarNomeTecnico,
  explicarStatus,
  motivoNaoEditavel,
  StatusExplicado,
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
    WhatsappFormatPipe,
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
  idiomasMaisUsados = IDIOMAS_META.filter(i => CODIGOS_IDIOMAS_MAIS_USADOS.includes(i.codigo));
  idiomasOutros = IDIOMAS_META.filter(i => !CODIGOS_IDIOMAS_MAIS_USADOS.includes(i.codigo));

  objetivos = OBJETIVOS_TEMPLATE;

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
  salvando = signal(false);
  search = signal('');

  // --- Assistente em 3 passos (objetivo -> escrever -> revisar) ---
  // A tela antiga jogava o formulário inteiro de uma vez, com o vocabulário da Meta
  // (HSM, categoria, BODY). Quem nunca criou template errava a categoria e tomava rejeição.
  passo = signal(1);
  objetivo = signal<ObjetivoTemplate | null>(null);
  nomeAmigavel = signal('');
  mostrarAvancado = signal(false);
  modeloAplicado = signal<string | null>(null);

  // Template em edição (null = formulário está em modo criação)
  modoEdicao = signal<Template | null>(null);

  objetivoInfo = computed<ObjetivoInfo | null>(
    () => this.objetivos.find(o => o.id === this.objetivo()) ?? null
  );

  modelosDoObjetivo = computed<ModeloPronto[]>(() => {
    const obj = this.objetivo();
    return obj ? MODELOS_PRONTOS.filter(m => m.objetivo === obj) : [];
  });

  nomeTecnico = computed(() => gerarNomeTecnico(this.nomeAmigavel()));

  variaveis = computed(() => (this.form().conteudo.match(/\{\{\d+\}\}/g) || []).length);

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

  // Cada item vira uma linha da revisão final: o usuário vê o que falta antes de gastar
  // uma submissão à Meta (template reprovado fica no histórico da conta).
  conferencia = computed(() => {
    const f = this.form();
    const header = this.headerState();
    const exemplos = this.exemplosBody();
    const itens: { ok: boolean; texto: string }[] = [
      { ok: !!this.objetivo(), texto: 'Objetivo escolhido (define a categoria enviada à Meta)' },
      { ok: !!this.nomeTecnico() || !!this.modoEdicao(), texto: 'Nome do modelo preenchido' },
      { ok: f.conteudo.trim().length >= 10, texto: 'Mensagem escrita' },
      { ok: exemplos.length === 0 || exemplos.every(e => e.value.trim()), texto: 'Exemplo preenchido para cada campo que muda' },
    ];
    if (header.tipo === 'TEXT') {
      itens.push({ ok: !!header.texto.trim(), texto: 'Texto do cabeçalho preenchido' });
    }
    if (header.tipo === 'IMAGE' || header.tipo === 'VIDEO' || header.tipo === 'DOCUMENT') {
      itens.push({ ok: !!header.exemploHandle, texto: 'Arquivo de exemplo do cabeçalho enviado' });
    }
    for (const b of this.botoes()) {
      if (b.tipo === 'COPY_CODE') {
        itens.push({ ok: !!b.codigoExemplo?.trim(), texto: 'Código de exemplo do botão de cupom' });
      } else {
        itens.push({ ok: !!b.texto?.trim(), texto: `Texto do botão "${b.texto || 'sem nome'}"` });
      }
      if (b.tipo === 'URL') {
        itens.push({ ok: !!b.url && /^https?:\/\/.+\..+/.test(b.url), texto: 'Link completo do botão (começando com https://)' });
      }
      if (b.tipo === 'PHONE_NUMBER') {
        itens.push({ ok: !!b.numeroTelefone?.trim(), texto: 'Número de telefone do botão' });
      }
    }
    return itens;
  });

  tudoConferido = computed(() => this.conferencia().every(i => i.ok));

  ngOnInit() {
    this.buscar();
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  // --- Navegação do assistente ---

  escolherObjetivo(obj: ObjetivoTemplate) {
    this.objetivo.set(obj);
    const info = this.objetivos.find(o => o.id === obj);
    if (info) this.update('categoria', info.categoria);
    this.response.set('');
    this.passo.set(2);
  }

  aplicarModelo(m: ModeloPronto) {
    this.nomeAmigavel.set(m.nomeSugerido);
    this.update('conteudo', m.conteudo);
    this.exemplosBody.set(m.exemplos.map(value => ({ value })));
    this.footerTexto.set(m.footer || '');
    this.botoes.set((m.botoes || []).map(b => ({ ...b })));
    this.headerState.set(headerStateVazio());
    this.modeloAplicado.set(m.id);
    this.passo.set(3);
  }

  comecarDoZero() {
    this.nomeAmigavel.set('');
    this.update('conteudo', '');
    this.exemplosBody.set([]);
    this.footerTexto.set('');
    this.botoes.set([]);
    this.headerState.set(headerStateVazio());
    this.modeloAplicado.set(null);
    this.passo.set(3);
  }

  irParaPasso(n: number) {
    // Só deixa pular pra frente se o passo atual já estiver válido -- voltar é sempre livre.
    if (n > this.passo() && this.erroDoPasso()) {
      this.response.set(`❌ ${this.erroDoPasso()}`);
      return;
    }
    this.response.set('');
    this.passo.set(n);
  }

  avancar() {
    const erro = this.erroDoPasso();
    if (erro) {
      this.response.set(`❌ ${erro}`);
      return;
    }
    this.response.set('');
    this.passo.update(p => Math.min(4, p + 1));
  }

  voltar() {
    this.response.set('');
    this.passo.update(p => Math.max(1, p - 1));
  }

  // Valida só o que pertence ao passo atual, pra mensagem de erro apontar o campo da vez
  erroDoPasso(): string | null {
    const f = this.form();

    if (this.passo() === 1 && !this.objetivo()) {
      return 'Escolha o que você quer enviar para continuar.';
    }

    if (this.passo() === 3) {
      if (!this.modoEdicao() && !this.nomeTecnico()) {
        return 'Dê um nome ao modelo (ex: Aviso de entrega).';
      }
      if (f.conteudo.trim().length < 10) {
        return 'Escreva a mensagem que o cliente vai receber.';
      }
      const exemplos = this.exemplosBody();
      if (exemplos.length > 0 && exemplos.some(e => !e.value.trim())) {
        return 'Preencha um exemplo para cada campo que muda ({{1}}, {{2}}...).';
      }
      const header = this.headerState();
      if (header.tipo === 'TEXT' && !header.texto.trim()) {
        return 'Informe o texto do cabeçalho ou remova o cabeçalho.';
      }
      if ((header.tipo === 'IMAGE' || header.tipo === 'VIDEO' || header.tipo === 'DOCUMENT') && !header.exemploHandle) {
        return 'Envie o arquivo de exemplo do cabeçalho antes de continuar.';
      }
      const botaoUrlInvalido = this.botoes().some(b => b.tipo === 'URL' && !/^https?:\/\/.+\..+/.test(b.url || ''));
      if (botaoUrlInvalido) {
        return 'Complete o endereço do botão de link (ex: https://sualoja.com.br/pedido).';
      }
      const botaoSemTexto = this.botoes().some(b => b.tipo !== 'COPY_CODE' && !b.texto?.trim());
      if (botaoSemTexto) {
        return 'Dê um texto a cada botão (o cliente vê esse texto no WhatsApp).';
      }
    }

    return null;
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

    if (!empId) {
      this.response.set('❌ Sessão sem empresa vinculada. Entre novamente para continuar.');
      return;
    }

    // A revisão final repete as checagens dos passos anteriores: dá pra chegar aqui e
    // depois voltar e apagar um campo.
    this.passo.set(3);
    const erro = this.erroDoPasso();
    this.passo.set(4);
    if (erro) {
      this.response.set(`❌ ${erro}`);
      return;
    }

    const header = this.headerState();
    const exemplos = this.exemplosBody().map(e => e.value.trim());

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

    this.salvando.set(true);

    if (editando) {
      this.response.set('⏳ Salvando alterações e reenviando para a Meta...');
      this.templateService.atualizar(editando.id, componentesPayload).subscribe({
        next: () => {
          this.response.set('✅ Alterações enviadas! A Meta vai analisar de novo — acompanhe o status na lista ao lado.');
          this.salvando.set(false);
          this.cancelarEdicao();
          this.buscar();
        },
        error: (err) => {
          this.salvando.set(false);
          this.response.set(`❌ Erro: ${extrairMensagemErro(err, 'Não foi possível salvar as alterações.')}`);
        }
      });
      return;
    }

    const payload = {
      idEmpresa: empId,
      nomeTemplate: this.nomeTecnico(),
      idioma: f.idioma,
      ...componentesPayload
    };

    this.response.set('⏳ Enviando seu modelo para a Meta...');

    this.templateService.incluir(payload).subscribe({
      next: () => {
        this.response.set('✅ Modelo enviado! A Meta costuma responder em até 24h — o status aparece na lista ao lado.');
        this.salvando.set(false);
        this.limparForm();
        this.buscar();
      },
      error: (err) => {
        this.salvando.set(false);
        this.response.set(`❌ Erro: ${extrairMensagemErro(err, 'Não foi possível salvar.')}`);
      }
    });
  }

  sincronizarComMeta() {
    const empId = this.empresaId();
    if (!empId) return;

    this.sincronizando.set(true);
    this.response.set('⏳ Buscando a situação mais recente dos seus modelos na Meta...');

    this.templateService.sincronizarComMeta(empId).subscribe({
      next: () => {
        this.response.set('✅ Lista atualizada com o que está na Meta.');
        this.sincronizando.set(false);
        this.buscar();
      },
      error: (err) => {
        this.response.set(`❌ Falha ao atualizar: ${extrairMensagemErro(err, 'Falha ao processar sincronização via PUT.')}`);
        this.sincronizando.set(false);
      }
    });
  }

  podeEditar(t: Template): boolean {
    return STATUS_EDITAVEIS.includes((t.status || '').toUpperCase());
  }

  motivoNaoEditavel(t: Template): string {
    return motivoNaoEditavel(t.status);
  }

  statusInfo(t: Template): StatusExplicado {
    return explicarStatus(t.status);
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

    this.nomeAmigavel.set(t.nomeTemplate);
    this.objetivo.set(this.objetivos.find(o => o.categoria === (t.categoria || '').toUpperCase())?.id ?? null);

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
    this.mostrarAvancado.set(true);
    this.passo.set(3);
    this.response.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicao() {
    this.modoEdicao.set(null);
    this.limparForm();
  }

  excluir(id: string) {
    if (!confirm('Tem certeza que deseja excluir este modelo? Ele sai da Meta (todas as versões de idioma com esse nome) e do seu cadastro. Disparos e flows que usam esse modelo param de funcionar.')) {
      return;
    }

    this.templateService.excluir(id).subscribe({
      next: () => {
        this.response.set('✅ Modelo excluído.');
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
    this.nomeAmigavel.set('');
    this.objetivo.set(null);
    this.modeloAplicado.set(null);
    this.mostrarAvancado.set(false);
    this.passo.set(1);
  }

  badgeClass(status?: string) {
    return explicarStatus(status).classe;
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
