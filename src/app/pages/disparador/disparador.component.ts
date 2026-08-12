import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';
import { TemplateService } from '../templates/template.service';
import { Template, TemplateComponente, parseComponentes } from '../templates/template.models';
import { AssistenteIaBotaoComponent } from '../../shared/assistente-ia/assistente-ia-botao';

interface Contato {
  id: string;
  nome?: string;
  telefone: string;
  email?: string;
  checked?: boolean;
}

interface NumeroMeta {
  id: string;
  usuarioId: string;
  telefone: string;
  descricao: string;
  instanciaId: string;
  statusMeta: string | null;
  qualidadeMeta: string | null;
  dataCriacao: string;
}

interface TemplateMeta extends Template {
  componentesParsed?: TemplateComponente[]; // Cache local pós-parse
}

@Component({
  selector: 'app-disparador',
  standalone: true,
  imports: [CommonModule, FormsModule, AssistenteIaBotaoComponent],
  templateUrl: './disparador.component.html',
  styleUrls: ['../shared-crud.css', './disparador.component.css'],
})
export class DisparadorComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private templateService = inject(TemplateService);

  private readonly API_CONTATO = `${environment.apiUrl}/contato`;
  private readonly API_NUMERO = `${environment.apiUrl}/numero`;
  private readonly API_DISPARO = `${environment.apiUrl}/disparador`;

  private empresaId = this.authService.empresaIdSignal;
  private userId = this.authService.usuarioIdSignal;

  // Signals de Estado
  contatos = signal<Contato[]>([]);
  templates = signal<TemplateMeta[]>([]);
  numerosAtivos = signal<NumeroMeta[]>([]);
  search = signal('');

  form = signal({
    templateId: '',
    instanciaId: '',
  });

  params = signal<{ value: string }[]>([]);
  buttonParams = signal<{ value: string }[]>([]);
  headerMediaUrl = signal('');
  temMediaHeader = signal(false);
  response = signal('');
  errosLote = signal<{ telefone: string; erro: string }[]>([]);
  explicacaoTemplate = signal('');

  // Computeds
  contatosFiltrados = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.contatos();
    return this.contatos().filter(c =>
      (c.nome && c.nome.toLowerCase().includes(termo)) ||
      c.telefone.includes(termo) ||
      (c.email && c.email.toLowerCase().includes(termo))
    );
  });

  selecionados = computed(() => this.contatos().filter(c => c.checked));

  isAllSelected = computed(() => {
    const filtrados = this.contatosFiltrados();
    if (filtrados.length === 0) return false;
    return filtrados.every(c => c.checked);
  });

  // Captura o objeto de template atualmente ativo e realiza o Parse do JSON interno
  templateAtivo = computed(() => {
    const tplId = this.form().templateId;
    const tpl = this.templates().find(t => t.id === tplId);
    if (!tpl) return null;

    if (!tpl.componentesParsed) {
      tpl.componentesParsed = parseComponentes(tpl.componentesJson);
    }
    return tpl;
  });

  templatePreview = computed(() => {
    const tpl = this.templateAtivo();
    if (!tpl) return 'Selecione um template para visualizar o preview...';

    let textoFormatado = '';

    if (this.temMediaHeader()) {
      const url = this.headerMediaUrl().trim() ? this.headerMediaUrl().trim() : 'https://www.theeagleview.com.br/2018/09/midia-em-clima-de-baixaria.html';
      textoFormatado += `🖼️ [MÍDIA HEADER]: ${url}\n\n`;
    }

    textoFormatado += tpl.conteudo;

    this.params().forEach((p, index) => {
      const valorSubstitutos = p.value.trim() ? p.value : `[Parâmetro ${index + 1}]`;
      const regex = new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g');
      textoFormatado = textoFormatado.replace(regex, valorSubstitutos);
    });

    return textoFormatado;
  });

  // Instrução pro assistente de IA "explicar" o template selecionado -- não há campo
  // de texto livre nesta tela (só variáveis de um template já aprovado pela Meta), então
  // a IA ajuda de outra forma: traduzindo o template pro atendente entender o que vai
  // ser enviado e conseguir explicar pro cliente antes de disparar.
  instrucaoExplicarTemplate = computed(() => {
    const tpl = this.templateAtivo();
    if (!tpl) return '';
    return `Explique em 1-2 frases simples, para um atendente que não escreveu este template, o que esta mensagem de WhatsApp comunica ao cliente e quando ela deve ser usada.`;
  });

  ngOnInit() {
    this.buscarContatos();
    this.buscarTemplates();
    this.buscarNumeros();
  }

  buscarContatos() {
    const uid = this.userId();
    if (!uid) return;
    this.http.get<Contato[]>(`${this.API_CONTATO}/obter-por-usuario/${uid}`)
      .subscribe({
        next: (res) => this.contatos.set(res.map(c => ({ ...c, checked: false }))),
        error: () => this.response.set('❌ Erro ao carregar contatos.')
      });
  }

  buscarTemplates() {
    const empId = this.empresaId();
    if (!empId) return;

    this.templateService.listar(empId)
      .subscribe({
        next: (res) => {
          const aprovados = (res as TemplateMeta[]).filter(t => t.status?.toUpperCase() === 'APPROVED');
          this.templates.set(aprovados);
        },
        error: () => this.response.set('❌ Erro ao carregar templates.')
      });
  }

  buscarNumeros() {
    const uid = this.userId();
    if (!uid) return;

    this.http.get<NumeroMeta[]>(`${this.API_NUMERO}/ListarNumeros/${uid}`)
      .subscribe({
        next: (res) => this.numerosAtivos.set(res),
        error: () => this.response.set('❌ Erro ao carregar canais/números.')
      });
  }

  onTemplateChange(id: string) {
    this.updateForm('templateId', id);

    // Reseta os estados anteriores
    this.explicacaoTemplate.set('');
    this.headerMediaUrl.set('');
    this.params.set([]);
    this.buttonParams.set([]);
    this.temMediaHeader.set(false);

    const tpl = this.templateAtivo();

    if (tpl && tpl.componentesParsed) {
      // 1. Captura variáveis dinâmicas do corpo
      const matches = tpl.conteudo.match(/\{\{\d+\}\}/g) || [];
      this.params.set(matches.map(() => ({ value: '' })));

      // 2. CORREÇÃO AQUI: Procura usando 'Tipo' e 'FormatMidia' em maiúsculo
      const headerComp = tpl.componentesParsed.find(c => c.Tipo === 0);
      if (headerComp && [2, 3, 4].includes(headerComp.FormatMidia)) {
        this.temMediaHeader.set(true); // Isso vai forçar o HTML a exibir o campo!
      }

      const buttonsComp = tpl.componentesParsed.find(c => c.Tipo === 3);
      if (buttonsComp && buttonsComp.Botoes) {
        const possuiUrlDinamica = buttonsComp.Botoes.some(b => b.Tipo === 1 && b.Url && b.Url.includes('{{1}}'));
        if (possuiUrlDinamica) {
          this.buttonParams.set([{ value: '' }]);
        }
      }
    }
  }

  updateForm(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  updateParam(index: number, val: string) {
    const p = [...this.params()];
    p[index] = { value: val };
    this.params.set(p);
  }

  updateButtonParam(index: number, val: string) {
    const bp = [...this.buttonParams()];
    bp[index] = { value: val };
    this.buttonParams.set(bp);
  }

  trackByIndex(index: number): number {
    return index;
  }

  toggleContato(contato: Contato) {
    this.contatos.update(list => list.map(c =>
      c.id === contato.id ? { ...c, checked: !c.checked } : c
    ));
  }

  selAll() {
    const marcarTodos = !this.isAllSelected();
    const filtradosIds = this.contatosFiltrados().map(c => c.id);
    this.contatos.update(list => list.map(c =>
      filtradosIds.includes(c.id) ? { ...c, checked: marcarTodos } : c
    ));
  }

  disparar() {
    if (!this.form().instanciaId) {
      this.response.set('❌ Selecione um número ativo (Instância).');
      return;
    }
    const tpl = this.templateAtivo();

    if (!tpl) {
      this.response.set('❌ Selecione um template de mensagem válido.');
      return;
    }

    if (this.temMediaHeader() && !this.headerMediaUrl().trim()) {
      this.response.set('❌ Insira a URL da imagem/mídia para o cabeçalho deste template.');
      return;
    }

    if (this.selecionados().length === 0) {
      this.response.set('❌ Selecione ao menos um contato na tabela.');
      return;
    }

    const empId = this.empresaId();
    if (!empId) {
      this.response.set('❌ Erro: Identificador da empresa não encontrado na sessão.');
      return;
    }

    const urlMidia = this.temMediaHeader() ? this.headerMediaUrl().trim() : null;
    const corpoParams = this.params().map(p => p.value.trim());
    const botaoParams = this.buttonParams().map(bp => bp.value.trim());

    const payload = {
      idEmpresa: empId,
      empresaId: empId,
      telefones: this.selecionados().map(c => c.telefone),
      contatosIds: this.selecionados().map(c => c.id), // ✅ INSERIDO EM PARALELO À LISTA DE TELEFONES
      nomeTemplate: tpl.nomeTemplate,
      idioma: tpl.idioma || 'pt_BR',
      templateId: tpl.id,
      parametroHeaderMediaUrl: urlMidia,
      parametrosBody: corpoParams,
      parametrosButton: botaoParams,
      contatoId: '00000000-0000-0000-0000-000000000000'
    };

    this.response.set('⏳ Iniciando envio em lote...');
    this.errosLote.set([]);

    this.http.post<any>(`${this.API_DISPARO}/EnviarMensagemTemplateLote`, payload).subscribe({
      next: (res: any) => {
        // O endpoint retorna o envelope Response<T> cru (sem passar por ValidateResponse),
        // então o resultado real vem em res.value, não em res.data.
        const relatorioDisparos: Record<string, boolean> = res?.value?.relatorioDisparos || {};
        const relatorioErros: Record<string, string> = res?.value?.relatorioErros || {};
        const telefones = Object.keys(relatorioDisparos);
        const total = telefones.length;
        const sucesso = telefones.filter(t => relatorioDisparos[t]).length;

        this.errosLote.set(Object.entries(relatorioErros).map(([telefone, erro]) => ({ telefone, erro })));

        if (total === 0) {
          this.response.set('⚠ O disparo terminou, mas a API não retornou nenhum resultado por telefone.');
        } else if (sucesso === total) {
          this.response.set(`✅ Disparo concluído! Sucesso: ${sucesso} de ${total}.`);
        } else {
          this.response.set(`⚠ Disparo concluído com falhas. Sucesso: ${sucesso} de ${total} — veja os erros abaixo.`);
        }

        this.params.set([]);
        this.buttonParams.set([]);
        this.headerMediaUrl.set('');
        this.temMediaHeader.set(false);
        this.updateForm('templateId', '');
        this.contatos.update(list => list.map(c => ({ ...c, checked: false })));
      },
      error: (err) => {
        this.response.set(`❌ Falha: ${extrairMensagemErro(err, 'Erro ao processar lote na API')}`);
      }
    });
  }
}
