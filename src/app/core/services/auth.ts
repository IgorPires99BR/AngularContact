// src/app/core/services/auth.ts
import { Injectable, signal, computed } from '@angular/core';

// Interface para garantir tipagem forte e autocompleto no projeto
export interface UserData {
  idUsuario: string;
  idEmpresa: string;
  nome?: string;
  email: string;
  role?: string;
  status?: string;
  token?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Inicializa o estado com o objeto completo ou null
  private userState = signal<UserData | null>(this.getUserFromStorage());

  // Expõe o objeto completo de forma somente leitura para componentes (como o Shell)
  readonly user = computed(() => this.userState());

  // Atalho reativo para o ID do Usuário (usado no authGuard e na tela de Números)
  readonly usuarioIdSignal = computed(() => this.userState()?.idUsuario);

  // Atalho reativo para o ID da Empresa (usado na tela de Templates e isolamento multi-tenant)
  readonly empresaIdSignal = computed(() => this.userState()?.idEmpresa);

  // Usado pelo adminGuard pra esconder as telas de administração de quem não é admin.
  // É só experiência de uso: quem manda de verdade é o backend, que devolve 403.
  readonly ehAdminSignal = computed(() => (this.userState()?.role ?? '').toLowerCase() === 'admin');

  getToken(): string | null {
    return this.userState()?.token ?? localStorage.getItem('token') ?? sessionStorage.getItem('token');
  }

  /**
   * @param remember Quando true, a sessão sobrevive ao fechar o navegador (localStorage).
   * Quando false, some ao fechar a aba/navegador (sessionStorage) — opção "Lembrar-me".
   */
  setSession(apiResponse: any, remember = true) {
    // Garante que a resposta contém os dados necessários antes de persistir
    if (apiResponse && typeof apiResponse === 'object') {
      const data: UserData = {
        idUsuario: apiResponse.idUsuario,
        idEmpresa: apiResponse.idEmpresa,
        nome: apiResponse.nome,
        email: apiResponse.email,
        role: apiResponse.role,
        status: apiResponse.status,
        token: apiResponse.token
      };

      // Limpa os dois storages antes de gravar, evitando sessão "fantasma" de um login anterior
      // com a outra escolha de "Lembrar-me"
      localStorage.removeItem('userData');
      localStorage.removeItem('usuarioId');
      localStorage.removeItem('empresaId');
      localStorage.removeItem('token');
      sessionStorage.removeItem('userData');
      sessionStorage.removeItem('usuarioId');
      sessionStorage.removeItem('empresaId');
      sessionStorage.removeItem('token');

      const store = remember ? localStorage : sessionStorage;
      store.setItem('userData', JSON.stringify(data));
      store.setItem('usuarioId', data.idUsuario);
      store.setItem('empresaId', data.idEmpresa);
      if (data.token) {
        store.setItem('token', data.token);
      }

      // Atualiza o Signal global de forma reativa
      this.userState.set(data);
    }
  }

  private getUserFromStorage(): UserData | null {
    const data = localStorage.getItem('userData') ?? sessionStorage.getItem('userData');
    return data ? JSON.parse(data) as UserData : null;
  }

  getInitials(email: string): string {
    if (!email) return '??';
    return email.substring(0, 2).toUpperCase();
  }

  logout() {
    // Limpa os dois storages: quando o login foi feito sem "Lembrar-me", a sessão fica no
    // sessionStorage, e limpar só o localStorage deixava o usuário logado depois do logout.
    localStorage.clear();
    sessionStorage.clear();
    this.userState.set(null);
  }
}
