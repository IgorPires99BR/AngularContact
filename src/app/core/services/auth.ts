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

  setSession(apiResponse: any) {
    // Garante que a resposta contém os dados necessários antes de persistir
    if (apiResponse && typeof apiResponse === 'object') {
      const data: UserData = {
        idUsuario: apiResponse.idUsuario,
        idEmpresa: apiResponse.idEmpresa,
        nome: apiResponse.nome,
        email: apiResponse.email,
        role: apiResponse.role,
        status: apiResponse.status
      };

      // Salva no localStorage para manter a sessão ao atualizar a página (F5)
      localStorage.setItem('userData', JSON.stringify(data));
      localStorage.setItem('usuarioId', data.idUsuario);
      localStorage.setItem('empresaId', data.idEmpresa);

      // Atualiza o Signal global de forma reativa
      this.userState.set(data);
    }
  }

  private getUserFromStorage(): UserData | null {
    const data = localStorage.getItem('userData');
    return data ? JSON.parse(data) as UserData : null;
  }

  getInitials(email: string): string {
    if (!email) return '??';
    return email.substring(0, 2).toUpperCase();
  }

  logout() {
    // Limpa todas as chaves do storage e reseta o Signal
    localStorage.clear();
    this.userState.set(null);
  }
}
