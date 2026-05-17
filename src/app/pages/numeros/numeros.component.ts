import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';

declare var FB: any;

interface Numero {
  id: string;
  usuarioId: string;
  telefone: string;       // Mapeado com a entidade C#
  descricao: string;
  instanciaId: string;    // Armazena o Phone Number ID vindo da Meta
  statusMeta: string;     // Mapeado com a entidade C#
  qualidadeMeta: string;  // Mapeado com a entidade C#
  dataCriacao?: string;
}

@Component({
  selector: 'app-numeros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './numeros.component.html',
  styleUrls: ['../shared-crud.css', './numeros.component.css'],
})
export class NumerosComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // URL base limpa apontando para a sua Controller C#
  private readonly API_URL = 'https://localhost:7118/api/numero';

  // ID do usuário logado vindo do seu serviço de autenticação global
  private userId = this.authService.usuarioIdSignal;

  // Form estruturado para o fluxo do CriaNumeroHandler
  form = signal({
    telefone: '',
    nomeVerificado: '',
    codigoPais: '55' // Padrão Brasil
  });

  response = signal('');
  numeros = signal<Numero[]>([]);
  sincronizando = signal(false);

  // Mapeia os estados da Meta (APPROVED, PENDING, CONNECTED, etc.) para os contadores visuais
  ativos = computed(() => this.numeros().filter(n =>
    n.statusMeta?.toUpperCase() === 'CONNECTED' ||
    n.statusMeta?.toUpperCase() === 'APPROVED' ||
    n.statusMeta?.toUpperCase() === 'LIVE'
  ).length);

  pendentes = computed(() => this.numeros().filter(n => n.statusMeta?.toUpperCase() === 'PENDING').length);

  bloqueados = computed(() => this.numeros().filter(n =>
    n.statusMeta?.toUpperCase() === 'DISCONNECTED' ||
    n.statusMeta?.toUpperCase() === 'FLAGGED' ||
    n.statusMeta?.toUpperCase() === 'BLOCKED'
  ).length);

  ngOnInit() {
    this.buscar();
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  // 1. LISTAR NÚMEROS LOCALMENTE
  buscar() {
    const uid = this.userId();
    if (!uid) return;

    // Rota exata mapeada no seu [HttpGet("api/numero/ListarNumeros/{usuarioId}")]
    this.http.get<Numero[]>(`${this.API_URL}/ListarNumeros/${uid}`)
      .subscribe({
        next: (res) => this.numeros.set(res),
        error: () => this.response.set('❌ Erro ao carregar números salvos no banco local.')
      });
  }

  // 2. SOLICITAR NOVO NÚMERO (META ONBOARDING + INCLUSÃO EM BANCO)
  incluir() {
    const f = this.form();
    const uid = this.userId();

    if (!f.telefone || !f.nomeVerificado || !f.codigoPais || !uid) {
      this.response.set('❌ Preencha todos os campos obrigatórios.');
      return;
    }

    // Payload limpo estruturado exatamente como o CriaNumeroCommand espera no C#
    const payload = {
      usuarioId: uid,
      numeroTelefone: f.telefone,
      nomeEmpresa: f.nomeVerificado
    };

    this.response.set('⏳ Solicitando criação na Meta e registrando...');

    // Rota exata mapeada no seu [HttpPost("api/numero/incluir")]
    this.http.post(`${this.API_URL}/incluir`, payload).subscribe({
      next: (res: any) => {
        if (res && res.success === false) {
          this.response.set(`❌ Erro: ${res.errors?.[0]?.message || 'Falha ao registrar.'}`);
          return;
        }
        this.response.set('✅ Número enviado para validação do nome e incluído com sucesso!');
        this.limparForm();
        this.buscar();
      },
      error: (err) => this.response.set(`❌ Erro no servidor: ${err.error?.message || 'Falha na comunicação.'}`)
    });
  }

  // 3. SINCRONIZAÇÃO VIA EMBEDDED SIGNUP (FACEBOOK DIALOG)
  iniciarEmbeddedSignup() {
    FB.login((response: any) => {
      if (response.authResponse) {
        // Envia o usuário para o fluxo que dispara o endpoint C# correspondente
        this.vincularContaMeta();
      } else {
        this.response.set('❌ Fluxo de Onboarding cancelado pelo usuário.');
      }
    }, {
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      extras: {
        feature: 'whatsapp_embedded_signup'
      }
    });
  }

  // 4. DISPARO DO ENDPOINT DE SINCRONIZAÇÃO/IMPORTAÇÃO DA META
  vincularContaMeta() {
    const uid = this.userId();
    if (!uid) {
      this.response.set('❌ Usuário não identificado para sincronização.');
      return;
    }

    this.sincronizando.set(true);
    this.response.set('⏳ Baixando atualizações e sincronizando banco com a Meta...');

    // Rota corrigida: Agora executa um HTTP GET apontando para api/numero/AtualizarNumerosMeta/{usuarioId}
    this.http.get(`${this.API_URL}/AtualizarNumerosMeta/${uid}`).subscribe({
      next: () => {
        this.response.set('✅ Banco local sincronizado com sucesso com a Meta!');
        this.sincronizando.set(false);
        this.buscar(); // Atualiza a tabela na interface trazendo as mudanças
      },
      error: (err) => {
        console.error(err);
        this.response.set('❌ Falha ao processar sincronização na API do servidor.');
        this.sincronizando.set(false);
      }
    });
  }

  // 5. EXCLUSÃO LOCAL DE REGISTRO
  excluir(id: string) {
    if (!confirm('Deseja deletar este número do seu painel local?')) return;

    this.http.delete(`${this.API_URL}/excluir/${id}`).subscribe({
      next: () => {
        this.numeros.update(list => list.filter(n => n.id !== id));
        this.response.set('✅ Registro removido localmente.');
      },
      error: () => this.response.set('❌ Erro ao tentar remover número do banco.')
    });
  }

  private limparForm() {
    this.form.set({ telefone: '', nomeVerificado: '', codigoPais: '55' });
  }

  badgeClass(status?: string) {
    if (!status) return 'badge-green';
    const s = status.toUpperCase();
    if (s === 'CONNECTED' || s === 'APPROVED' || s === 'LIVE') return 'badge-green';
    if (s === 'PENDING') return 'badge-warn';
    return 'badge-danger';
  }
}
