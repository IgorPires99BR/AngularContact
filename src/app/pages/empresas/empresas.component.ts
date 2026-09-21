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
  search = signal('');

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

  prepararEdicao(empresa: Empresa) {
    this.editingId.set(empresa.id);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({ nome: '', cnpj: '', email: '', tel: '', metaAccessToken: '', planoId: '', wabaId: '', phoneNumberId: '', appIdMeta: '' });
    this.response.set('');
  }

  salvar() {
    const f = this.form();
    if (!f.nome || !f.cnpj) {
      this.response.set('❌ Nome e CNPJ são obrigatórios');
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

    if (this.editingId()) {
      payload.id = this.editingId();
      payload.accessToken = f.metaAccessToken; // Mapeia para alterar

      this.http.put(`${this.BASE_URL}/alterar`, payload).subscribe({
        next: () => {
          this.response.set('✅ Empresa atualizada com sucesso!');
          this.cancelarEdicao();
          this.obterEmpresas();
        },
        error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Erro ao atualizar empresa.'))
      });
    } else { // <-- AGORA SIM! Adicionado o else correto
      payload.accessToken = f.metaAccessToken; // Mapeia Corretamente para incluir

      this.http.post(`${this.BASE_URL}/incluir`, payload).subscribe({
        next: () => {
          this.response.set('✅ Empresa cadastrada com sucesso!');
          this.cancelarEdicao();
          this.obterEmpresas();
        },
        error: (err) => this.response.set('❌ ' + extrairMensagemErro(err, 'Falha ao salvar empresa.'))
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
