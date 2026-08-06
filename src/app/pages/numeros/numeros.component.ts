import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

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
  tipoConexao?: number;   // 1 = ApiOficial, 2 = Coexistencia (TipoConexaoNumero no backend)
  statusConexao?: string; // Pendente, Conectado, Erro, Desconectado
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

  private readonly API_URL = `${environment.apiUrl}/numero`;

  // ID do usuário logado vindo do seu serviço de autenticação global
  private userId = this.authService.usuarioIdSignal;

  // ID da empresa ativa resgatado do sinal global do AuthService
  empresaId = this.authService.empresaIdSignal;

  form = signal({
    telefone: '',
    nomeVerificado: '',
    codigoPais: '55'
  });

  response = signal('');
  numeros = signal<Numero[]>([]);
  sincronizando = signal(false);

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
    this.carregarDadosIniciais();
  }

  carregarDadosIniciais() {
    this.buscar();
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  // Aceita só dígitos (telefone e código do país não têm letra/pontuação). Escreve
  // direto no elemento pra não depender do timing do change detection do Angular.
  updateSomenteNumeros(field: string, input: HTMLInputElement, maxDigitos: number) {
    const apenasDigitos = input.value.replace(/\D/g, '').slice(0, maxDigitos);
    input.value = apenasDigitos;
    this.form.set({ ...this.form(), [field]: apenasDigitos });
  }

  buscar() {
    const uid = this.userId();
    if (!uid) return;

    this.http.get<Numero[]>(`${this.API_URL}/ListarNumeros/${uid}`)
      .subscribe({
        next: (res) => this.numeros.set(res),
        error: () => this.response.set('❌ Erro ao carregar números salvos no banco local.')
      });
  }

  // Método incluir ajustado para contemplar o idEmpresa no Command
  incluir() {
    const f = this.form();
    const uid = this.userId();
    const eid = this.empresaId(); // Resgata o ID da empresa ativa

    if (!f.telefone || !f.nomeVerificado || !f.codigoPais || !uid) {
      this.response.set('❌ Preencha todos os campos obrigatórios.');
      return;
    }

    // Payload atualizado exatamente conforme a classe CriaNumeroCommand do C#
    const payload = {
      usuarioId: uid,
      idEmpresa: eid, // Injetado dinamicamente do contexto da sessão
      numeroTelefone: f.telefone,
      nomeEmpresa: f.nomeVerificado
    };

    this.response.set('⏳ Solicitando criação na Meta e registrando...');

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

  embeddedSignupCarregando = signal(false);
  coexistenciaAtivandoId = signal<string | null>(null);

  iniciarEmbeddedSignup() {
    const f = this.form();

    if (!f.telefone || !f.nomeVerificado) {
      this.response.set('❌ Preencha o telefone e o nome comercial antes de conectar via Embedded Signup.');
      return;
    }

    if (typeof FB === 'undefined') {
      this.response.set('❌ SDK da Meta não carregado. Verifique o appId em index.html (ver docs/deploy-embedded-signup-coex.md).');
      return;
    }

    FB.login((response: any) => {
      // No fluxo de Embedded Signup a Meta retorna um "code" de autorização em authResponse.code
      // (exige response_type: 'code' + override_default_response_type: true nas extras do login)
      const code = response?.authResponse?.code;

      if (code) {
        this.concluirEmbeddedSignup(code);
      } else {
        this.response.set('❌ Fluxo de Onboarding cancelado pelo usuário ou sem "code" retornado pela Meta.');
      }
    }, {
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        feature: 'whatsapp_embedded_signup',
        // Configuracao de login criada em developers.facebook.com > WhatsApp > Configurador
        // de cadastro incorporado > "Contact cadastro". Sem isso o popup nao abre o fluxo
        // certo de selecao de WABA/numero.
        config_id: '2444573049378034'
      }
    });
  }

  concluirEmbeddedSignup(code: string) {
    const f = this.form();
    const uid = this.userId();
    const eid = this.empresaId();

    if (!uid || !eid) {
      this.response.set('❌ Usuário ou empresa não identificados para concluir o Embedded Signup.');
      return;
    }

    const payload = {
      usuarioId: uid,
      idEmpresa: eid,
      code,
      numeroTelefone: f.telefone,
      nomeEmpresa: f.nomeVerificado
    };

    this.embeddedSignupCarregando.set(true);
    this.response.set('⏳ Trocando código de autorização e vinculando número via Embedded Signup...');

    this.http.post(`${this.API_URL}/embedded-signup`, payload).subscribe({
      next: () => {
        this.response.set('✅ Número conectado via Embedded Signup com sucesso!');
        this.embeddedSignupCarregando.set(false);
        this.limparForm();
        this.buscar();
      },
      error: (err) => {
        const erros = Array.isArray(err.error) ? err.error.join(', ') : (err.error?.message || 'Falha na comunicação.');
        this.response.set(`❌ Erro no Embedded Signup: ${erros}`);
        this.embeddedSignupCarregando.set(false);
      }
    });
  }

  ativarCoexistencia(numeroId: string) {
    const eid = this.empresaId();

    if (!eid) {
      this.response.set('❌ Empresa não identificada para ativar coexistência.');
      return;
    }

    // A Meta exige o PIN de verificação em 2 etapas cadastrado para este número
    const pin = prompt('Digite o PIN de verificação em 2 etapas (6 dígitos) cadastrado para este número na Meta:');
    if (!pin) {
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      this.response.set('❌ O PIN deve ter exatamente 6 dígitos numéricos.');
      return;
    }

    this.coexistenciaAtivandoId.set(numeroId);
    this.response.set('⏳ Ativando coexistência (WhatsApp Business App + Cloud API)...');

    const url = `${this.API_URL}/ativa-coexistencia?numeroId=${numeroId}&idEmpresa=${eid}`;

    this.http.post(url, { pin }).subscribe({
      next: () => {
        this.response.set('✅ Coexistência ativada com sucesso!');
        this.coexistenciaAtivandoId.set(null);
        this.buscar();
      },
      error: (err) => {
        const erros = Array.isArray(err.error) ? err.error.join(', ') : (err.error?.message || 'Falha na comunicação.');
        this.response.set(`❌ Erro ao ativar coexistência: ${erros}`);
        this.coexistenciaAtivandoId.set(null);
      }
    });
  }

  vincularContaMeta() {
    const uid = this.userId();
    const eid = this.empresaId();

    if (!uid) {
      this.response.set('❌ Usuário não identificado para sincronização.');
      return;
    }

    this.sincronizando.set(true);
    this.response.set('⏳ Baixando atualizações e sincronizando banco com a Meta...');

    const url = `${this.API_URL}/AtualizarNumerosMeta/${uid}?idEmpresa=${eid}`;

    this.http.post(url, {}).subscribe({
      next: () => {
        this.response.set('✅ Banco local sincronizado com sucesso com a Meta!');
        this.sincronizando.set(false);
        this.buscar();
      },
      error: (err) => {
        console.error(err);
        this.response.set('❌ Falha ao processar sincronização na API do servidor.');
        this.sincronizando.set(false);
      }
    });
  }

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
