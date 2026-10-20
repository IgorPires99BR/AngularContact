import { Component, signal, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth';
import { isEmailValido } from '../../shared/utils/validators';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';
import { UsuariosDaEmpresaComponent } from '../usuarios/usuarios-da-empresa.component';

declare var FB: any;

interface Empresa {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cnpj?: string;
  accessToken?: string;   // Mapeado de MetaAccessToken
  wabaId?: string;        // Mapeado de WabaId
  phoneNumberId?: string; // Mapeado de PhoneNumberId
  appIdMeta?: string;     // Mapeado de AppIdMeta (usado no upload de mídia de exemplo dos templates)
  dataCriacao: string;
  planoId?: string;
  // CONTA_PROPRIA = WABA próprio (Embedded Signup); CONTACT_SOLUTION = dispara pelo número da
  // plataforma. Calculado na API comparando com o WABA da Contact Solution.
  tipoConexao?: 'CONTA_PROPRIA' | 'CONTACT_SOLUTION';
}

interface DadosBancarios {
  // Subconta Asaas que recebe o repasse; vazio = ainda não criada.
  asaasWalletId: string;
  asaasContaCriadaEm: string | null;
  // Conta Asaas propria da empresa (fora da plataforma), vinculada so pelo walletId.
  carteiraExterna: boolean;
  cobrancaPixAtiva: boolean;
  // Definida só pelo admin da plataforma; para os demais é só leitura.
  comissaoTipo: string;
  comissaoValor: number | null;
}

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule, UsuariosDaEmpresaComponent],
  templateUrl: './empresas.component.html',
  styleUrls: ['../shared-crud.css', './empresas.component.css'],
})
export class EmpresasComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly BASE_URL = `${environment.apiUrl}/v2/empresa`;

  // Cadastro rapido: cria empresa + usuario admin + senha + e-mail de acesso de uma vez.
  // Antes so o webhook de pagamento da Cakto fazia a conta inteira; cadastrar um cliente que
  // fechou por fora exigia criar a empresa aqui e o usuario admin dela direto no banco, porque
  // a tela de Usuarios sempre usa a empresa de quem esta logado.
  ehAdminDaPlataforma = this.authService.ehAdminDaPlataforma;

  contaForm = signal<any>({ nome: '', email: '', telefone: '', cnpj: '', plano: 'STARTER', pagamentoJaConfirmado: false, empresaId: null });
  criandoConta = signal(false);
  erroConta = signal('');
  contaCriada = signal<{ email: string; senhaProvisoria: string } | null>(null);
  senhaCopiada = signal(false);

  atualizarConta(campo: string, valor: any) {
    this.contaForm.update(f => ({ ...f, [campo]: valor }));
    if (this.erroConta()) this.erroConta.set('');
  }

  criarContaCliente() {
    const f = this.contaForm();

    if (!f.nome.trim()) { this.erroConta.set('Informe o nome do cliente.'); return; }
    if (!isEmailValido(f.email)) { this.erroConta.set('Informe um e-mail válido — é por ele que o cliente entra.'); return; }

    this.criandoConta.set(true);
    this.erroConta.set('');

    this.http.post<any>(`${this.BASE_URL}/criar-conta-cliente`, f).subscribe({
      next: (r) => {
        this.criandoConta.set(false);
        const dados = Array.isArray(r) ? r[0] : (r?.value ?? r);
        this.contaCriada.set({ email: dados?.email ?? f.email, senhaProvisoria: dados?.senhaProvisoria ?? '' });
        this.contaForm.set({ nome: '', email: '', telefone: '', cnpj: '', plano: 'STARTER', pagamentoJaConfirmado: false, empresaId: null });
        this.obterEmpresas();
      },
      error: (err) => {
        this.criandoConta.set(false);
        this.erroConta.set(extrairMensagemErro(err, 'Não foi possível criar a conta.'));
      }
    });
  }

  // Empresa cadastrada que nunca teve usuario e peso morto: ninguem entra nela. Isto cria o
  // acesso dela sem duplicar a empresa ao lado.
  prepararAcesso(e: any) {
    this.contaCriada.set(null);
    this.erroConta.set('');
    this.contaForm.set({
      nome: e.nome ?? '',
      email: e.email ?? '',
      telefone: e.telefone ?? '',
      cnpj: e.cnpj ?? '',
      plano: e.planoId || 'STARTER',
      pagamentoJaConfirmado: false,
      empresaId: e.id,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarAcesso() {
    this.contaForm.set({ nome: '', email: '', telefone: '', cnpj: '', plano: 'STARTER', pagamentoJaConfirmado: false, empresaId: null });
  }

  copiarAcesso() {
    const c = this.contaCriada();
    if (!c) return;
    navigator.clipboard?.writeText(`Acesso Contact Solution\nSite: https://contactsolution.com.br/login\nE-mail: ${c.email}\nSenha: ${c.senhaProvisoria}`)
      .then(() => { this.senhaCopiada.set(true); setTimeout(() => this.senhaCopiada.set(false), 2500); });
  }

  empresas = signal<Empresa[]>([]);
  // DEPOIS (Correto):
  form = signal({
    nome: '',
    cnpj: '',
    email: '',
    tel: '',
    metaAccessToken: '',
    planoId: '',
    wabaId: '',
    phoneNumberId: '',
    appIdMeta: ''
  });
  response = signal('');
  editingId = signal<string | null>(null);
  // Linha em edição como veio da API: o tipo de conexão não é campo do formulário.
  empresaEmEdicao = computed(() => this.empresas().find(e => e.id === this.editingId()) ?? null);
  salvando = signal(false);
  search = signal('');

  rotuloConexao(e: Empresa): string {
    return e.tipoConexao === 'CONTA_PROPRIA' ? '📱 Embedded Signup (conta Meta própria)' : '🏢 Domínio Contact Solution';
  }

  ajudaConexao(e: Empresa): string {
    return e.tipoConexao === 'CONTA_PROPRIA'
      ? 'A empresa tem WABA e número próprios: os disparos saem pela conta Meta dela.'
      : 'A empresa usa o WABA e o número da Contact Solution: os disparos saem pelo número da plataforma.';
  }

  empresasFiltradas = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.empresas();
    return this.empresas().filter(e =>
      e.nome?.toLowerCase().includes(termo) ||
      e.cnpj?.toLowerCase().includes(termo) ||
      e.email?.toLowerCase().includes(termo)
    );
  });

  ngOnInit() {
    this.obterEmpresas();
    window.addEventListener('message', this.embeddedSignupListener);
  }

  ngOnDestroy() {
    window.removeEventListener('message', this.embeddedSignupListener);
  }

  // --- Embedded Signup a nivel de Empresa: da pra ela sua propria conta Meta (WabaId,
  // PhoneNumberId, AccessToken proprios), em vez de compartilhar o numero da Contact
  // Solution. Mesmo mecanismo do fluxo de Numero (ver numeros.component.ts), so que o
  // resultado e gravado na Empresa em vez de criar um Numero novo.
  private phoneNumberIdSignup: string | null = null;
  private wabaIdSignup: string | null = null;
  conectandoMeta = signal<string | null>(null);

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

  conectarMeta(empresa: Empresa) {
    if (typeof FB === 'undefined') {
      this.response.set('❌ SDK da Meta não carregado.');
      return;
    }

    this.phoneNumberIdSignup = null;
    this.wabaIdSignup = null;

    FB.login((resposta: any) => {
      const code = resposta?.authResponse?.code;
      if (code) {
        this.concluirConexaoMeta(empresa.id, code);
      } else {
        this.response.set('❌ Conexão com a Meta cancelada ou sem código de autorização retornado.');
      }
    }, {
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        feature: 'whatsapp_embedded_signup',
        config_id: '2444573049378034'
      }
    });
  }

  private concluirConexaoMeta(empresaId: string, code: string) {
    if (!this.phoneNumberIdSignup) {
      this.response.set('❌ A Meta não retornou o identificador do número (phone_number_id). Tente novamente.');
      return;
    }

    this.conectandoMeta.set(empresaId);
    this.response.set('⏳ Conectando a empresa à conta Meta dela...');

    const payload = {
      empresaId,
      code,
      phoneNumberId: this.phoneNumberIdSignup,
      wabaId: this.wabaIdSignup
    };

    this.http.post<any>(`${this.BASE_URL}/conectar-meta`, payload).subscribe({
      next: () => {
        this.conectandoMeta.set(null);
        this.response.set('✅ Empresa conectada à própria conta Meta! Disparos dela agora saem pelo número próprio.');
        this.obterEmpresas();
      },
      error: (err) => {
        this.conectandoMeta.set(null);
        this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao conectar a empresa à Meta.'));
      }
    });
  }

  update(field: string, value: string) {
    this.form.set({ ...this.form(), [field]: value });
  }

  // Aceita só dígitos e limita a quantidade (ex: CNPJ = 14). Escreve direto no
  // elemento pra não depender do timing do ciclo de change detection do Angular.
  updateSomenteNumeros(field: string, input: HTMLInputElement, maxDigitos: number) {
    const apenasDigitos = input.value.replace(/\D/g, '').slice(0, maxDigitos);
    input.value = apenasDigitos;
    this.form.set({ ...this.form(), [field]: apenasDigitos });
  }

  obterEmpresas() {
    this.http.get<Empresa[]>(`${this.BASE_URL}/obter`).subscribe({
      next: (dados) => this.empresas.set(dados),
      error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao carregar empresas.'))
    });
  }

  // --- Dados bancarios: subconta Asaas onde a empresa recebe o repasse das cobrancas aos
  // clientes dela. O Pix e gerado na conta Asaas da plataforma e o split manda para a subconta o
  // valor menos a comissao (o Asaas so faz split entre contas Asaas). Endpoint proprio (nao vai
  // junto do salvar da empresa) porque a comissao so pode ser mexida pelo admin da plataforma.
  bancario = signal<DadosBancarios>(this.dadosBancariosVazios());
  carregandoBancario = signal(false);
  // O salvar único só grava os dados bancários se eles carregaram: senão mandaria os valores
  // vazios do formulário e desligaria a cobrança Pix de quem tinha.
  private bancarioCarregado = signal(false);
  msgBancario = signal('');
  msgBancarioErro = signal(false);

  // Cadastro da subconta: dados que o Asaas exige. Nao ficam gravados aqui, so os ids que o
  // Asaas devolve.
  subconta = signal<any>(this.subcontaVazia());
  criandoSubconta = signal(false);
  msgSubconta = signal('');
  subcontaEhCpf = computed(() => (this.subconta().cpfCnpj || '').replace(/\D/g, '').length === 11);

  private subcontaVazia() {
    return {
      nome: '', email: '', cpfCnpj: '', dataNascimento: '', tipoEmpresa: '', celular: '',
      faturamentoMensal: null, endereco: '', numero: '', complemento: '', bairro: '', cep: ''
    };
  }

  atualizarSubconta(campo: string, valor: any) {
    this.subconta.update(s => ({ ...s, [campo]: valor }));
    if (this.msgSubconta()) this.msgSubconta.set('');
  }

  criarSubconta() {
    const empresaId = this.editingId();
    if (!empresaId) return;

    const s = this.subconta();
    const ehCpf = this.subcontaEhCpf();
    const payload = {
      empresaId,
      nome: s.nome,
      email: s.email,
      cpfCnpj: s.cpfCnpj,
      dataNascimento: ehCpf && s.dataNascimento ? s.dataNascimento : null,
      tipoEmpresa: ehCpf ? null : (s.tipoEmpresa || null),
      celular: s.celular,
      faturamentoMensal: s.faturamentoMensal === '' ? null : s.faturamentoMensal,
      endereco: s.endereco,
      numero: s.numero,
      complemento: s.complemento,
      bairro: s.bairro,
      cep: s.cep,
    };

    this.criandoSubconta.set(true);
    this.msgSubconta.set('');

    this.http.post<any>(`${this.BASE_URL}/dados-bancarios/subconta-asaas`, payload).subscribe({
      next: (r) => {
        this.criandoSubconta.set(false);
        this.aplicarDadosBancarios(r?.dadosBancarios ?? r);
        this.msgBancarioErro.set(false);
        this.msgBancario.set('✅ Subconta Asaas criada. O Asaas envia ao e-mail informado o acesso para a empresa enviar os documentos e sacar os valores.');
      },
      error: (err) => {
        this.criandoSubconta.set(false);
        this.msgSubconta.set(extrairMensagemErro(err, 'Não foi possível criar a subconta Asaas.'));
      }
    });
  }

  // Subconta aberta pelo painel do Asaas: so o walletId, o backend confere no Asaas que ela e
  // da conta da plataforma. So admin da plataforma (o endpoint tambem barra).
  walletIdExistente = signal('');
  carteiraExterna = signal(false);
  vinculandoSubconta = signal(false);
  msgVinculo = signal('');

  vincularSubconta() {
    const empresaId = this.editingId();
    if (!empresaId) return;

    this.vinculandoSubconta.set(true);
    this.msgVinculo.set('');

    this.http.post<any>(`${this.BASE_URL}/dados-bancarios/vincular-subconta-asaas`, { empresaId, walletId: this.walletIdExistente().trim(), carteiraExterna: this.carteiraExterna() }).subscribe({
      next: (r) => {
        this.vinculandoSubconta.set(false);
        this.walletIdExistente.set('');
        this.carteiraExterna.set(false);
        this.aplicarDadosBancarios(r?.dadosBancarios ?? r);
        this.msgBancarioErro.set(false);
        this.msgBancario.set(`✅ Subconta${r?.nomeSubconta ? ' de ' + r.nomeSubconta : ''} vinculada. As cobranças Pix pagas passam a ser repassadas para ela.`);
      },
      error: (err) => {
        this.vinculandoSubconta.set(false);
        this.msgVinculo.set(extrairMensagemErro(err, 'Não foi possível vincular a subconta Asaas.'));
      }
    });
  }

  // Situacao cadastral da subconta no Asaas. So sob demanda: o Asaas pede uns segundos depois
  // da criacao para listar os documentos certos, e cada consulta sao duas chamadas a ele.
  situacaoSubconta = signal<any>(null);
  consultandoSituacao = signal(false);
  msgSituacao = signal('');

  consultarSituacaoSubconta() {
    const empresaId = this.editingId();
    if (!empresaId) return;
    this.consultandoSituacao.set(true);
    this.msgSituacao.set('');

    this.http.get<any>(`${this.BASE_URL}/${empresaId}/dados-bancarios/situacao-subconta`).subscribe({
      next: (s) => {
        if (this.editingId() !== empresaId) return;
        this.consultandoSituacao.set(false);
        this.situacaoSubconta.set(s);
      },
      error: (err) => {
        this.consultandoSituacao.set(false);
        this.msgSituacao.set(extrairMensagemErro(err, 'Não foi possível consultar a situação da subconta.'));
      }
    });
  }

  rotuloStatusAsaas(status: string | null | undefined): string {
    switch (status) {
      case 'APPROVED': return 'Aprovado';
      case 'AWAITING_APPROVAL': return 'Em análise';
      case 'REJECTED': return 'Recusado';
      case 'NOT_SENT': return 'Não enviado';
      case 'IGNORED': return 'Dispensado';
      case 'PENDING': return 'Pendente';
      default: return status || '-';
    }
  }

  descricaoComissao = computed(() => {
    const b = this.bancario();
    if (!b.comissaoTipo || b.comissaoValor === null) return 'ainda não definida';
    return b.comissaoTipo === 'PERCENTUAL'
      ? `${b.comissaoValor.toLocaleString('pt-BR')}% do valor cobrado`
      : `${b.comissaoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por cobrança paga`;
  });

  private dadosBancariosVazios(): DadosBancarios {
    return { asaasWalletId: '', asaasContaCriadaEm: null, carteiraExterna: false, cobrancaPixAtiva: false, comissaoTipo: '', comissaoValor: null };
  }

  private aplicarDadosBancarios(d: any) {
    this.bancario.set({
      asaasWalletId: d?.asaasWalletId ?? '',
      asaasContaCriadaEm: d?.asaasContaCriadaEm ?? null,
      carteiraExterna: !!d?.carteiraExterna,
      cobrancaPixAtiva: !!d?.cobrancaPixAtiva,
      comissaoTipo: d?.comissaoTipo ?? '',
      comissaoValor: d?.comissaoValor ?? null,
    });
  }

  carregarDadosBancarios(empresaId: string) {
    this.aplicarDadosBancarios(null);
    this.msgBancario.set('');
    this.situacaoSubconta.set(null);
    this.msgSituacao.set('');
    this.carregandoBancario.set(true);
    this.bancarioCarregado.set(false);

    this.http.get<any>(`${this.BASE_URL}/${empresaId}/dados-bancarios`).subscribe({
      next: (d) => {
        // Resposta de outra empresa que chegou depois de o usuario trocar de linha: descarta.
        if (this.editingId() !== empresaId) return;
        this.carregandoBancario.set(false);
        this.aplicarDadosBancarios(d);
        this.bancarioCarregado.set(true);
      },
      error: (err) => {
        this.carregandoBancario.set(false);
        this.msgBancarioErro.set(true);
        this.msgBancario.set(extrairMensagemErro(err, 'Não foi possível carregar os dados bancários.'));
      }
    });
  }

  atualizarBancario(campo: keyof DadosBancarios, valor: any) {
    this.bancario.update(b => ({ ...b, [campo]: valor }));
    if (this.msgBancario()) this.msgBancario.set('');
  }

  // Campo numerico vazio vira null (comissao nao definida), nao 0.
  atualizarComissaoValor(valor: any) {
    const numero = valor === '' || valor === null || valor === undefined ? null : Number(valor);
    this.atualizarBancario('comissaoValor', numero !== null && isNaN(numero) ? null : numero);
  }

  // Segunda metade do salvar único da edição: roda depois que os dados da empresa foram gravados.
  // Só fecha o formulário se deu tudo certo; aviso ou erro do Asaas deixa aberto para corrigir.
  private salvarDadosBancarios() {
    const empresaId = this.editingId();
    if (!empresaId) return;

    if (!this.bancarioCarregado()) {
      this.salvando.set(false);
      this.response.set('✅ Empresa atualizada. Os dados bancários não carregaram e não foram alterados.');
      return;
    }

    const b = this.bancario();
    // A API ignora a comissao de quem nao e admin da plataforma; nem manda, pra deixar claro.
    const payload: any = {
      empresaId,
      cobrancaPixAtiva: b.cobrancaPixAtiva,
    };
    if (this.ehAdminDaPlataforma()) {
      payload.comissaoTipo = b.comissaoTipo || null;
      payload.comissaoValor = b.comissaoValor;
    }

    this.msgBancario.set('');

    this.http.put<any>(`${this.BASE_URL}/dados-bancarios`, payload).subscribe({
      next: (r) => {
        this.salvando.set(false);
        this.aplicarDadosBancarios(r?.dadosBancarios ?? r);
        // Ao ativar a cobrança a API já testa a conexão com o Asaas; os dados ficam salvos
        // mesmo se ela falhar, por isso vem como aviso e não como erro.
        if (r?.avisoIntegracao) {
          this.msgBancarioErro.set(true);
          this.msgBancario.set('⚠️ ' + r.avisoIntegracao);
          this.response.set('✅ Empresa e dados bancários salvos, com um aviso do Asaas (veja em Dados bancários).');
          return;
        }
        this.cancelarEdicao();
        this.response.set(r?.credenciaisConferidas
          ? '✅ Empresa atualizada. Conexão com o Asaas conferida.'
          : '✅ Empresa atualizada com sucesso!');
      },
      error: (err) => {
        this.salvando.set(false);
        this.msgBancarioErro.set(true);
        this.msgBancario.set(extrairMensagemErro(err, 'Não foi possível salvar os dados bancários.'));
        this.response.set('⚠️ Dados da empresa salvos, mas os dados bancários não (veja em Dados bancários).');
      }
    });
  }


  prepararEdicao(empresa: Empresa) {
    this.editingId.set(empresa.id);
    this.carregarDadosBancarios(empresa.id);
    // Ponto de partida para a subconta: quase sempre o titular e a propria empresa.
    this.subconta.set({
      ...this.subcontaVazia(),
      nome: empresa.nome || '',
      email: empresa.email || '',
      cpfCnpj: empresa.cnpj || '',
      celular: empresa.telefone || '',
    });
    this.msgSubconta.set('');
    this.walletIdExistente.set('');
    this.msgVinculo.set('');
    this.form.set({
      nome: empresa.nome,
      cnpj: empresa.cnpj || '',
      email: empresa.email || '',
      tel: empresa.telefone || '',
      metaAccessToken: empresa.accessToken || '', // Garanta que o mapeamento do token está batendo com o que vem da API
      planoId: empresa.planoId || '',
      wabaId: empresa.wabaId || '',
      phoneNumberId: empresa.phoneNumberId || '',
      appIdMeta: empresa.appIdMeta || ''
    });
    this.response.set(`Editando: ${empresa.nome}`);
    // O formulario fica abaixo do cadastro rapido: rola ate ele, nao ate o topo.
    document.querySelector('.form-empresa')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({ nome: '', cnpj: '', email: '', tel: '', metaAccessToken: '', planoId: '', wabaId: '', phoneNumberId: '', appIdMeta: '' });
    this.response.set('');
    this.aplicarDadosBancarios(null);
    this.bancarioCarregado.set(false);
    this.msgBancario.set('');
    this.subconta.set(this.subcontaVazia());
    this.msgSubconta.set('');
    this.walletIdExistente.set('');
    this.msgVinculo.set('');
  }

  salvar() {
    const f = this.form();
    if (!f.nome || !f.cnpj) {
      this.response.set('❌ Razão social e CNPJ são obrigatórios.');
      return;
    }

    if (f.cnpj.length !== 14) {
      this.response.set('❌ CNPJ inválido. Deve conter 14 dígitos.');
      return;
    }

    if (f.email && !isEmailValido(f.email)) {
      this.response.set('❌ E-mail inválido.');
      return;
    }

    if (f.tel && f.tel.length < 10) {
      this.response.set('❌ Telefone inválido. Informe DDI + DDD + número (mínimo 10 dígitos).');
      return;
    }

    // Payload unificado contendo as propriedades digitadas
    const payload: any = {
      nome: f.nome,
      email: f.email,
      telefone: f.tel,
      cnpj: f.cnpj,
      planoId: f.planoId,
      wabaId: f.wabaId,
      phoneNumberId: f.phoneNumberId,
      appIdMeta: f.appIdMeta
    };

    payload.accessToken = f.metaAccessToken;
    this.salvando.set(true);

    if (this.editingId()) {
      payload.id = this.editingId();

      this.http.put(`${this.BASE_URL}/alterar`, payload).subscribe({
        next: () => {
          this.obterEmpresas();
          this.salvarDadosBancarios();
        },
        error: (err) => {
          this.salvando.set(false);
          this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao atualizar empresa.'));
        }
      });
    } else {
      this.http.post(`${this.BASE_URL}/incluir`, payload).subscribe({
        next: () => {
          this.salvando.set(false);
          this.cancelarEdicao();
          this.response.set('✅ Empresa cadastrada! Clique em Editar nela para configurar os dados bancários.');
          this.obterEmpresas();
        },
        error: (err) => {
          this.salvando.set(false);
          this.response.set('❌ ' + extrairMensagemErro(err, 'Falha ao salvar empresa.'));
        }
      });
    }
  }

  // Qual empresa esta com o painel de usuarios aberto embaixo da linha (uma so por vez, pra
  // nao acumular varios paineis na tela). null = nenhum.
  empresaComUsuariosAbertos = signal<string | null>(null);

  toggleUsuarios(empresaId: string) {
    this.empresaComUsuariosAbertos.set(
      this.empresaComUsuariosAbertos() === empresaId ? null : empresaId
    );
  }

  excluir(id: string) {
    if (confirm('Deseja realmente excluir esta empresa?')) {
      this.http.delete(`${this.BASE_URL}/excluir/${id}`).subscribe({
        next: () => {
          this.response.set('🗑️ Empresa removida.');
          this.obterEmpresas();
        },
        error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao excluir.'))
      });
    }
  }
}
