import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

interface TemplateBotao {
  tipo: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  texto: string;
  url?: string;
  numeroTelefone?: string;
}

interface Template {
  id: string;
  empresaId: string;
  nomeTemplate: string;
  conteudo: string;
  categoria: string;
  idioma: string;
  status: string; // APPROVED, PENDING, REJECTED
  componentesJson?: string;
  dataCriacao?: string;
}

// Mapeia o enum TipoBotaoTemplate (C#, serializado como número) de volta pro tipo legível
const TIPO_BOTAO_POR_INDICE: TemplateBotao['tipo'][] = ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'];

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './templates.html',
  styleUrls: ['../shared-crud.css', './templates.css']
})
export class TemplatesComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // URL Base mapeada exatamente conforme a convenção da sua controller
  private readonly API_URL = `${environment.apiUrl}/template`;

  // Resgatando o Id da Empresa logada do AuthService
  private empresaId = this.authService.empresaIdSignal;
  private usuarioId = this.authService.usuarioIdSignal;

  form = signal({
    nomeTemplate: '',
    categoria: 'UTILITY',
    idioma: 'pt_BR',
    conteudo: ''
  });

  botoes = signal<TemplateBotao[]>([]);

  // --- Cabeçalho (HEADER) opcional ---
  headerTipo = signal<'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'>('NONE');
  headerTexto = signal('');
  headerExemploHandle = signal('');
  headerExemploNomeArquivo = signal('');
  uploadingHeader = signal(false);

  // --- Exemplos exigidos pela Meta para cada {{n}} do corpo ---
  exemplosBody = signal<{ value: string }[]>([]);

  response = signal('');
  templates = signal<Template[]>([]);
  sincronizando = signal(false);
  search = signal('');

  templatesFiltrados = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.templates();
    return this.templates().filter(t =>
      t.nomeTemplate?.toLowerCase().includes(termo) ||
      t.categoria?.toLowerCase().includes(termo) ||
      t.status?.toLowerCase().includes(termo)
    );
  });

  // Contadores inteligentes baseados no status retornado pelo banco
  aprovados = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'APPROVED').length);
  pendentes = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'PENDING').length);
  rejeitados = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'REJECTED' || t.status?.toUpperCase() === 'REJECTED_META').length);

  // Prévia do corpo da mensagem com variáveis {{1}}, {{2}} preenchidas pelos exemplos
  // digitados (ou um placeholder enquanto o exemplo não é preenchido)
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

  // Chamado a cada alteração do corpo: mantém a lista de exemplos do mesmo
  // tamanho da quantidade de variáveis {{n}} encontradas, preservando o que já
  // foi digitado nas posições que continuam existindo
  onConteudoChange(valor: string) {
    this.update('conteudo', valor);
    const quantidade = (valor.match(/\{\{\d+\}\}/g) || []).length;
    const atuais = this.exemplosBody();
    this.exemplosBody.set(Array.from({ length: quantidade }, (_, i) => atuais[i] ?? { value: '' }));
  }

  updateExemploBody(index: number, valor: string) {
    const arr = [...this.exemplosBody()];
    arr[index] = { value: valor };
    this.exemplosBody.set(arr);
  }

  // --- Cabeçalho (HEADER) ---

  onHeaderTipoChange(tipo: string) {
    this.headerTipo.set(tipo as any);
    this.headerTexto.set('');
    this.headerExemploHandle.set('');
    this.headerExemploNomeArquivo.set('');
  }

  onHeaderArquivoSelecionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo) return;

    const empId = this.empresaId();
    if (!empId) {
      this.response.set('❌ Empresa não identificada na sessão.');
      return;
    }

    this.uploadingHeader.set(true);
    this.headerExemploHandle.set('');
    this.response.set('⏳ Enviando arquivo de exemplo para a Meta...');

    const formData = new FormData();
    formData.append('empresaId', empId);
    formData.append('arquivo', arquivo);

    this.http.post<{ handle: string }>(`${this.API_URL}/upload-midia-exemplo`, formData).subscribe({
      next: (res) => {
        this.uploadingHeader.set(false);
        if (!res?.handle) {
          this.response.set('❌ Upload concluído, mas a Meta não retornou o identificador do arquivo.');
          return;
        }
        this.headerExemploHandle.set(res.handle);
        this.headerExemploNomeArquivo.set(arquivo.name);
        this.response.set('✅ Arquivo de exemplo enviado. Já pode cadastrar o template.');
      },
      error: (err) => {
        this.uploadingHeader.set(false);
        this.response.set(`❌ Erro no upload: ${extrairMensagemErro(err, 'Falha ao enviar o arquivo.')}`);
        input.value = '';
      }
    });
  }

  // --- Gestão dos botões do formulário de criação ---

  adicionarBotao(tipo: TemplateBotao['tipo']) {
    if (this.botoes().length >= 3) {
      this.response.set('❌ A Meta permite no máximo 3 botões por template.');
      return;
    }
    if (tipo === 'PHONE_NUMBER' && this.botoes().some(b => b.tipo === 'PHONE_NUMBER')) {
      this.response.set('❌ Só é permitido 1 botão de telefone por template.');
      return;
    }
    this.botoes.update(list => [...list, { tipo, texto: '' }]);
  }

  atualizarBotao(index: number, campo: keyof TemplateBotao, valor: string) {
    this.botoes.update(list =>
      list.map((b, i) => i === index ? { ...b, [campo]: valor } : b)
    );
  }

  // Botão do tipo Telefone: aceita só dígitos e um "+" opcional no início (formato
  // esperado pela Meta), diferente do texto livre dos demais campos de botão.
  atualizarTelefoneBotao(index: number, input: HTMLInputElement) {
    const comSinal = input.value.trim().startsWith('+') ? '+' : '';
    const digitos = input.value.replace(/\D/g, '').slice(0, 15);
    const telefone = comSinal + digitos;
    input.value = telefone;
    this.atualizarBotao(index, 'numeroTelefone', telefone);
  }

  removerBotao(index: number) {
    this.botoes.update(list => list.filter((_, i) => i !== index));
  }

  rotuloTipoBotao(tipo: TemplateBotao['tipo']) {
    if (tipo === 'QUICK_REPLY') return 'Resposta Rápida';
    if (tipo === 'URL') return 'Link';
    return 'Telefone';
  }

  // 1. LISTAR TEMPLATES (Corrigido para api/template/Listar/{empresaId})
  buscar() {
    const empId = this.empresaId();
    if (!empId) return;

    this.http.get<Template[]>(`${this.API_URL}/Listar/${empId}`)
      .subscribe({
        next: (res) => this.templates.set(res),
        error: (err) => this.response.set(`❌ ${extrairMensagemErro(err, 'Erro ao buscar templates locais.')}`)
      });
  }

  // 2. INCLUIR NOVO TEMPLATE (Bate no [HttpPost("api/template/incluir")])
  incluir() {
    const f = this.form();
    const empId = this.empresaId();

    if (!f.nomeTemplate || !f.conteudo || !empId) {
      this.response.set('❌ Preencha os campos obrigatórios (Nome e Conteúdo).');
      return;
    }

    const headerTipo = this.headerTipo();
    if (headerTipo === 'TEXT' && !this.headerTexto().trim()) {
      this.response.set('❌ Informe o texto do cabeçalho.');
      return;
    }
    if ((headerTipo === 'IMAGE' || headerTipo === 'VIDEO' || headerTipo === 'DOCUMENT') && !this.headerExemploHandle()) {
      this.response.set('❌ Envie o arquivo de exemplo do cabeçalho antes de cadastrar o template.');
      return;
    }

    const exemplos = this.exemplosBody().map(e => e.value.trim());
    if (exemplos.length > 0 && exemplos.some(e => !e)) {
      this.response.set('❌ Preencha um valor de exemplo para cada variável {{n}} do corpo.');
      return;
    }

    // Força o nome a seguir o padrão estrito de snake_case exigido pela Meta
    const nomeTratado = f.nomeTemplate.trim().toLowerCase().replace(/\s+/g, '_');

    const payload = {
      idEmpresa: empId,
      nomeTemplate: nomeTratado,
      categoria: f.categoria,
      idioma: f.idioma,
      conteudo: f.conteudo,
      botoes: this.botoes().length > 0 ? this.botoes() : null,
      headerTipo: headerTipo === 'NONE' ? null : headerTipo,
      headerTexto: headerTipo === 'TEXT' ? this.headerTexto().trim() : null,
      headerExemploHandle: (headerTipo === 'IMAGE' || headerTipo === 'VIDEO' || headerTipo === 'DOCUMENT') ? this.headerExemploHandle() : null,
      exemplosBody: exemplos.length > 0 ? exemplos : null
    };

    this.response.set('⏳ Registrando template no ecossistema da Meta...');

    this.http.post(`${this.API_URL}/incluir`, payload).subscribe({
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

  // 3. SINCRONIZAR COM A META (Corrigido para HTTP PUT e rota AtualizaTemplateMeta/{empresaId})
  sincronizarComMeta() {
    const empId = this.empresaId();
    if (!empId) return;

    this.sincronizando.set(true);
    this.response.set('⏳ Buscando atualizações e sincronizando com o WABA...');

    // O método na controller aceita o Guid via URL e é um [HttpPut]
    this.http.put(`${this.API_URL}/AtualizaTemplateMeta/${empId}`, {}).subscribe({
      next: () => {
        this.response.set('✅ Painel de templates atualizado com a Meta!');
        this.sincronizando.set(false);
        this.buscar(); // Recarrega a grade
      },
      error: (err) => {
        this.response.set(`❌ Falha ao sincronizar: ${extrairMensagemErro(err, 'Falha ao processar sincronização via PUT.')}`);
        this.sincronizando.set(false);
      }
    });
  }

  // Opcional: Como não há endpoint de exclusão na Controller de Templates,
  // deixei o método preparado aqui para quando você implementar no C#.
  excluir(id: string) {
    alert('A exclusão física de templates deve ser realizada direto no painel do Facebook Business Suite para evitar multas de conformidade na Meta, ou adicione o endpoint HttpDelete correspondente na controller.');
  }

  private limparForm() {
    this.form.set({
      nomeTemplate: '',
      categoria: 'UTILITY',
      idioma: 'pt_BR',
      conteudo: ''
    });
    this.botoes.set([]);
    this.headerTipo.set('NONE');
    this.headerTexto.set('');
    this.headerExemploHandle.set('');
    this.headerExemploNomeArquivo.set('');
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
  botoesDoTemplate(t: Template): TemplateBotao[] {
    if (!t.componentesJson) return [];
    try {
      const componentes = JSON.parse(t.componentesJson);
      const componenteBotoes = componentes?.find((c: any) => c.Tipo === 3 || c.tipo === 3);
      const lista = componenteBotoes?.Botoes || componenteBotoes?.botoes || [];
      return lista.map((b: any) => ({
        tipo: TIPO_BOTAO_POR_INDICE[b.Tipo ?? b.tipo] ?? 'QUICK_REPLY',
        texto: b.Texto ?? b.texto,
        url: b.Url ?? b.url
      }));
    } catch {
      return [];
    }
  }
}
