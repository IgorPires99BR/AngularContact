// src/app/core/services/auth.ts
import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Inicializa o estado com o objeto completo do localStorage (se existir)
  private userState = signal<any>(this.getUserFromStorage());

  // Expõe o objeto para o Shell
  readonly user = computed(() => this.userState());

  // Atalho para o ID do usuário (usado no Guard)
  readonly usuarioIdSignal = computed(() => this.userState()?.idUsuario);

  setSession(apiResponse: any) {
    // IMPORTANTE: apiResponse deve ser o objeto { status, idEmpresa, idUsuario, role, email }
    if (apiResponse && typeof apiResponse === 'object') {
      localStorage.setItem('userData', JSON.stringify(apiResponse));
      localStorage.setItem('usuarioId', apiResponse.idUsuario);

      this.userState.set(apiResponse);
    }
  }

  private getUserFromStorage(): any {
    const data = localStorage.getItem('userData');
    return data ? JSON.parse(data) : null;
  }

  getInitials(email: string): string {
    if (!email) return '??';
    return email.substring(0, 2).toUpperCase();
  }

  logout() {
    localStorage.clear();
    this.userState.set(null);
  }
}
