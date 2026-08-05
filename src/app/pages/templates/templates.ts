import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule, FormsModule],
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

  response = signal('');
  templates = signal<Template[]>([]);
  sincronizando = signal(false);

  // Contadores inteligentes baseados no status retornado pelo banco
  aprovados = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'APPROVED').length);
  pendentes = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'PENDING').length);
  rejeitados = computed(() => this.templates().filter(t => t.status?.toUpperCase() === 'REJECTED' || t.status?.toUpperCase() === 'REJECTED_META').length);

  // Prévia do corpo da mensagem com variáveis {{1}}, {{2}} preenchidas por valores de exemplo,
  // pra dar uma ideia real de como o template vai aparecer no WhatsApp
  preview = computed(() => {
    const conteudo = this.form().conteudo;
    if (!conteudo) return '';
    const exemplos = ['João', '48291', '15/08', 'R$ 129,90', '10%'];
    let i = 0;
    return conteudo.replace(/\{\{\d+\}\}/g, () => exemplos[i++ % exemplos.length]);
  });

  ngOnInit() {
    this.buscar();
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
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
        error: () => this.response.set('❌ Erro ao buscar templates locais.')
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

    // Força o nome a seguir o padrão estrito de snake_case exigido pela Meta
    const nomeTratado = f.nomeTemplate.trim().toLowerCase().replace(/\s+/g, '_');

    const payload = {
      idEmpresa: empId,
      nomeTemplate: nomeTratado,
      categoria: f.categoria,
      idioma: f.idioma,
      conteudo: f.conteudo,
      botoes: this.botoes().length > 0 ? this.botoes() : null
    };

    this.response.set('⏳ Registrando template no ecossistema da Meta...');

    this.http.post(`${this.API_URL}/incluir`, payload).subscribe({
      next: (res: any) => {
        if (res && res.success === false) {
          this.response.set(`❌ Erro: ${res.errors?.[0]?.message || 'Falha ao processar.'}`);
          return;
        }
        this.response.set('✅ Template enviado com sucesso para análise da Meta e salvo localmente!');
        this.limparForm();
        this.buscar();
      },
      error: (err) => {
        const erros = Array.isArray(err.error) ? err.error.join(', ') : (err.error?.message || 'Não foi possível salvar.');
        this.response.set(`❌ Erro: ${erros}`);
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
        console.error(err);
        this.response.set('❌ Falha ao processar sincronização via PUT.');
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
