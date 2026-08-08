import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { isEmailValido } from '../../shared/utils/validators';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './empresas.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class EmpresasComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly BASE_URL = `${environment.apiUrl}/v2/empresa`;

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
