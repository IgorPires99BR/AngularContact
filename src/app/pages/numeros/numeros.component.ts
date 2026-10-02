import { Component, signal, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

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

// Perfil do WhatsApp Business (ObtemPerfilNumeroResult): o que o cliente final vê no contato.
interface PerfilNumero {
  numeroId: string;
  telefone: string;
  ehCoexistencia: boolean;
  sobre?: string;
  descricao?: string;
  endereco?: string;
  email?: string;
  sites: string[];
  segmento?: string;
  fotoUrl?: string;
  nomeExibido?: string;
  novoNomeSolicitado?: string;
  statusNovoNome?: string;
}

// Lista fechada da Meta (campo vertical) com rótulo em português.
const SEGMENTOS: { valor: string; rotulo: string }[] = [
  { valor: 'OTHER', rotulo: 'Outro' },
  { valor: 'APPAREL', rotulo: 'Roupas e acessórios' },
  { valor: 'AUTO', rotulo: 'Automotivo' },
  { valor: 'BEAUTY', rotulo: 'Beleza, spa e salão' },
  { valor: 'EDU', rotulo: 'Educação' },
  { valor: 'ENTERTAIN', rotulo: 'Entretenimento' },
  { valor: 'EVENT_PLAN', rotulo: 'Eventos' },
  { valor: 'FINANCE', rotulo: 'Finanças e bancos' },
  { valor: 'GROCERY', rotulo: 'Mercado e alimentos' },
  { valor: 'GOVT', rotulo: 'Serviço público' },
  { valor: 'HEALTH', rotulo: 'Saúde' },
  { valor: 'HOTEL', rotulo: 'Hotelaria e hospedagem' },
  { valor: 'NONPROFIT', rotulo: 'Sem fins lucrativos' },
  { valor: 'PROF_SERVICES', rotulo: 'Serviços profissionais' },
  { valor: 'RESTAURANT', rotulo: 'Restaurante' },
  { valor: 'RETAIL', rotulo: 'Varejo' },
  { valor: 'TRAVEL', rotulo: 'Viagens e transporte' },
  { valor: 'ALCOHOL', rotulo: 'Bebidas alcoólicas' },
  { valor: 'OTC_DRUGS', rotulo: 'Medicamentos sem receita' },
  { valor: 'ONLINE_GAMBLING', rotulo: 'Apostas online' },
  { valor: 'PHYSICAL_GAMBLING', rotulo: 'Apostas presenciais' },
];

@Component({
  selector: 'app-numeros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './numeros.component.html',
  styleUrls: ['../shared-crud.css', './numeros.component.css'],
})
export class NumerosComponent implements OnInit, OnDestroy {
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
  search = signal('');

  numerosFiltrados = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.numeros();
    return this.numeros().filter(n =>
      n.telefone?.toLowerCase().includes(termo) ||
      n.descricao?.toLowerCase().includes(termo) ||
      n.statusMeta?.toLowerCase().includes(termo)
    );
  });

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

  // Preenchidos pelo evento "message" que a Meta dispara no meio do fluxo de Embedded
  // Signup (WA_EMBEDDED_SIGNUP), separado do callback de FB.login que só devolve o "code".
  // Sem isso, o backend nunca sabe qual phone_number_id/waba_id a Meta atribuiu ao
  // número recem-conectado.
  private phoneNumberIdSignup: string | null = null;
  private wabaIdSignup: string | null = null;
  private embeddedSignupListener = (event: MessageEvent) => {
    if (event.origin !== 'https://www.facebook.com') return;
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.event === 'FINISH') {
        this.phoneNumberIdSignup = data?.data?.phone_number_id ?? null;
        this.wabaIdSignup = data?.data?.waba_id ?? null;
      }
    } catch {
      // Mensagens de outra origem/formato que não interessam a este fluxo são ignoradas.
    }
  };

  ngOnInit() {
    this.carregarDadosIniciais();
    window.addEventListener('message', this.embeddedSignupListener);
  }

  ngOnDestroy() {
    window.removeEventListener('message', this.embeddedSignupListener);
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

    if (f.telefone.length < 8) {
      this.response.set('❌ Telefone inválido. Informe o número completo, sem o código do país.');
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
      next: () => {
        this.response.set('✅ Número enviado para validação do nome e incluído com sucesso!');
        this.limparForm();
        this.buscar();
      },
      error: (err) => this.response.set(`❌ Erro: ${extrairMensagemErro(err, 'Falha ao registrar.')}`)
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

    if (!this.phoneNumberIdSignup) {
      this.response.set('❌ A Meta não retornou o identificador do número (phone_number_id) via Embedded Signup. Tente novamente.');
      return;
    }

    const payload = {
      usuarioId: uid,
      idEmpresa: eid,
      code,
      numeroTelefone: f.telefone,
      nomeEmpresa: f.nomeVerificado,
      phoneNumberId: this.phoneNumberIdSignup,
      wabaId: this.wabaIdSignup
    };

    this.embeddedSignupCarregando.set(true);
    this.response.set('⏳ Trocando código de autorização e vinculando número via Embedded Signup...');

    this.http.post(`${this.API_URL}/embedded-signup`, payload).subscribe({
      next: () => {
        this.response.set('✅ Número conectado via Embedded Signup com sucesso!');
        this.embeddedSignupCarregando.set(false);
        this.phoneNumberIdSignup = null;
        this.wabaIdSignup = null;
        this.limparForm();
        this.buscar();
      },
      error: (err) => {
        this.response.set(`❌ Erro no Embedded Signup: ${extrairMensagemErro(err)}`);
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
        this.response.set(`❌ Erro ao ativar coexistência: ${extrairMensagemErro(err)}`);
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
        this.response.set(`❌ Falha ao sincronizar: ${extrairMensagemErro(err, 'Falha ao processar sincronização na API do servidor.')}`);
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

  // --- Perfil do número (foto, nome exibido e textos que o cliente final vê) ---

  segmentos = SEGMENTOS;
  numeroEmEdicao = signal<Numero | null>(null);
  perfil = signal<PerfilNumero | null>(null);
  perfilForm = signal({ sobre: '', descricao: '', endereco: '', email: '', site1: '', site2: '', segmento: '' });
  novoNome = signal('');
  carregandoPerfil = signal(false);
  salvandoPerfil = signal(false);
  enviandoFoto = signal(false);
  enviandoNome = signal(false);
  mensagemPerfil = signal('');
  // Prévia local enquanto a Meta processa a foto nova (a URL dela demora a refletir a troca).
  fotoPrevia = signal<string | null>(null);

  abrirPerfil(n: Numero) {
    this.numeroEmEdicao.set(n);
    this.perfil.set(null);
    this.fotoPrevia.set(null);
    this.novoNome.set('');
    this.mensagemPerfil.set('');
    this.carregarPerfil();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  fecharPerfil() {
    this.numeroEmEdicao.set(null);
    this.perfil.set(null);
    this.fotoPrevia.set(null);
  }

  carregarPerfil() {
    const n = this.numeroEmEdicao();
    if (!n) return;

    this.carregandoPerfil.set(true);
    this.http.get<PerfilNumero>(`${this.API_URL}/${n.id}/perfil`).subscribe({
      next: (p) => {
        this.perfil.set(p);
        this.perfilForm.set({
          sobre: p.sobre || '',
          descricao: p.descricao || '',
          endereco: p.endereco || '',
          email: p.email || '',
          site1: p.sites?.[0] || '',
          site2: p.sites?.[1] || '',
          // Perfil sem segmento volta "UNDEFINED" da Meta, que ela mesma não aceita de volta no envio.
          segmento: SEGMENTOS.some(s => s.valor === p.segmento) ? p.segmento! : ''
        });
        this.carregandoPerfil.set(false);
      },
      error: (err) => {
        this.mensagemPerfil.set(`❌ ${extrairMensagemErro(err, 'Não foi possível carregar o perfil deste número na Meta.')}`);
        this.carregandoPerfil.set(false);
      }
    });
  }

  updatePerfil(field: string, value: string) {
    this.perfilForm.set({ ...this.perfilForm(), [field]: value });
  }

  salvarPerfil() {
    const n = this.numeroEmEdicao();
    if (!n) return;
    const f = this.perfilForm();

    const payload = {
      sobre: f.sobre,
      descricao: f.descricao,
      endereco: f.endereco,
      email: f.email,
      sites: [f.site1, f.site2].map(s => s.trim()).filter(s => s),
      segmento: f.segmento || null
    };

    this.salvandoPerfil.set(true);
    this.mensagemPerfil.set('⏳ Salvando o perfil na Meta...');
    this.http.put(`${this.API_URL}/${n.id}/perfil`, payload).subscribe({
      next: () => {
        this.mensagemPerfil.set('✅ Perfil atualizado. Os clientes já veem as informações novas no WhatsApp.');
        this.salvandoPerfil.set(false);
      },
      error: (err) => {
        this.mensagemPerfil.set(`❌ ${extrairMensagemErro(err, 'Não foi possível salvar o perfil.')}`);
        this.salvandoPerfil.set(false);
      }
    });
  }

  trocarFoto(input: HTMLInputElement) {
    const n = this.numeroEmEdicao();
    const arquivo = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo depois de um erro
    if (!n || !arquivo) return;

    if (!['image/jpeg', 'image/png'].includes(arquivo.type)) {
      this.mensagemPerfil.set('❌ A foto precisa ser JPG ou PNG.');
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      this.mensagemPerfil.set('❌ A foto pode ter no máximo 5 MB.');
      return;
    }

    const dados = new FormData();
    dados.append('arquivo', arquivo);

    this.enviandoFoto.set(true);
    this.mensagemPerfil.set('⏳ Enviando a foto para a Meta...');
    this.http.post(`${this.API_URL}/${n.id}/foto`, dados).subscribe({
      next: () => {
        this.fotoPrevia.set(URL.createObjectURL(arquivo));
        this.mensagemPerfil.set('✅ Foto trocada. Pode levar alguns minutos para aparecer no WhatsApp dos clientes.');
        this.enviandoFoto.set(false);
      },
      error: (err) => {
        this.mensagemPerfil.set(`❌ ${extrairMensagemErro(err, 'Não foi possível trocar a foto.')}`);
        this.enviandoFoto.set(false);
      }
    });
  }

  solicitarNovoNome() {
    const n = this.numeroEmEdicao();
    const nome = this.novoNome().trim();
    if (!n) return;
    if (!nome) {
      this.mensagemPerfil.set('❌ Digite o novo nome que os clientes vão ver.');
      return;
    }

    this.enviandoNome.set(true);
    this.mensagemPerfil.set('⏳ Enviando o novo nome para análise da Meta...');
    this.http.post(`${this.API_URL}/${n.id}/nome`, { novoNome: nome }).subscribe({
      next: () => {
        this.mensagemPerfil.set('✅ Pedido enviado. A Meta analisa o nome (costuma levar de horas a alguns dias); quando aprovar, volte aqui e clique em "Aplicar nome aprovado".');
        this.novoNome.set('');
        this.enviandoNome.set(false);
        this.carregarPerfil();
      },
      error: (err) => {
        this.mensagemPerfil.set(`❌ ${extrairMensagemErro(err, 'Não foi possível pedir a troca do nome.')}`);
        this.enviandoNome.set(false);
      }
    });
  }

  aplicarNomeAprovado() {
    const n = this.numeroEmEdicao();
    if (!n) return;

    // Mesmo PIN da coexistência: a Meta só troca o nome quando o número é registrado de novo.
    const pin = prompt('Para aplicar o nome aprovado, digite o PIN de verificação em 2 etapas (6 dígitos) deste número:');
    if (!pin) return;
    if (!/^\d{6}$/.test(pin)) {
      this.mensagemPerfil.set('❌ O PIN deve ter exatamente 6 dígitos numéricos.');
      return;
    }

    this.enviandoNome.set(true);
    this.mensagemPerfil.set('⏳ Aplicando o nome aprovado...');
    this.http.post(`${this.API_URL}/${n.id}/nome/aplicar`, { pin }).subscribe({
      next: () => {
        this.mensagemPerfil.set('✅ Nome aplicado! Os clientes passam a ver o nome novo nas próximas mensagens.');
        this.enviandoNome.set(false);
        this.carregarPerfil();
        this.buscar();
      },
      error: (err) => {
        this.mensagemPerfil.set(`❌ ${extrairMensagemErro(err, 'Não foi possível aplicar o nome.')}`);
        this.enviandoNome.set(false);
      }
    });
  }

  // A Meta mantém APPROVED depois que o nome já foi aplicado; só falta aplicar se ainda difere do atual.
  nomeAguardandoAplicacao(p: PerfilNumero): boolean {
    return (p.statusNovoNome || '').toUpperCase() === 'APPROVED'
      && !!p.novoNomeSolicitado && p.novoNomeSolicitado !== p.nomeExibido;
  }

  statusNovoNome(p: PerfilNumero): { rotulo: string; classe: string } | null {
    const s = (p.statusNovoNome || '').toUpperCase();
    if (!s || s === 'NONE') return null;
    if (s === 'APPROVED') return this.nomeAguardandoAplicacao(p) ? { rotulo: 'Aprovado — falta aplicar', classe: 'badge-green' } : null;
    if (s === 'DECLINED' || s === 'REJECTED') return { rotulo: 'Recusado pela Meta', classe: 'badge-danger' };
    if (s.includes('PENDING') || s.includes('REVIEW')) return { rotulo: 'Em análise na Meta', classe: 'badge-warn' };
    return { rotulo: s, classe: 'badge-muted' };
  }

  // Status vazio nao e "conectado": e "a Meta ainda nao respondeu sobre este numero".
  // Fingir CONNECTED aqui foi o que fez a tela mostrar 0 ativos e a lista dizer CONNECTED
  // na mesma pagina.
  rotuloStatus(status?: string): string {
    if (!status) return 'NÃO SINCRONIZADO';
    return status.toUpperCase();
  }

  ajudaStatus(status?: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'CONNECTED' || s === 'APPROVED' || s === 'LIVE') return 'Número pronto para enviar mensagens.';
    if (s === 'PENDING') return 'A Meta ainda está verificando este número.';
    if (s === 'DISCONNECTED' || s === 'FLAGGED' || s === 'BLOCKED') return 'Número com restrição na Meta — verifique no Business Manager.';
    return 'Clique em "Sincronizar Meta" para trazer a situação atual deste número.';
  }

  badgeClass(status?: string) {
    if (!status) return 'badge-muted';
    const s = status.toUpperCase();
    if (s === 'CONNECTED' || s === 'APPROVED' || s === 'LIVE') return 'badge-green';
    if (s === 'PENDING') return 'badge-warn';
    return 'badge-danger';
  }
}
