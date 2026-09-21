import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './core/services/auth';

function possuiSessao(authService: AuthService): boolean {
  return !!authService.usuarioIdSignal()
    || !!localStorage.getItem('usuarioId')
    || !!sessionStorage.getItem('usuarioId');
}

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificamos se existe o ID do usuário salvo (no Signal, ou em qualquer um dos storages —
  // localStorage para sessão "lembrada", sessionStorage para sessão temporária)
  const isAuthenticated = !!authService.usuarioIdSignal()
    || !!localStorage.getItem('usuarioId')
    || !!sessionStorage.getItem('usuarioId');

  if (isAuthenticated) {
    return true; // Deixa o Igor ou o José Victor passarem
  } else {
    // Se não houver ID, redireciona para o Login
    router.navigate(['/login']);
    return false;
  }
};

// Protege as telas de administração (empresas, usuários). Antes qualquer usuário logado
// abria essas telas e via todas as empresas cadastradas, inclusive o token da Meta de cada uma.
// O backend já bloqueia por conta própria (403); isso aqui evita mostrar uma tela quebrada.
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.usuarioIdSignal() && !localStorage.getItem('usuarioId') && !sessionStorage.getItem('usuarioId')) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.ehAdminSignal()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

// Protege telas exclusivas da conta de plataforma (Contact Solution), como Perfis de Acesso --
// nao basta ser admin de uma empresa cliente (ehAdminSignal), tem que ser a conta que
// administra todos os tenants.
export const platformAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!possuiSessao(authService)) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.ehAdminDaPlataforma()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

// Protege uma tela especifica pela estrutura de acesso modular (Perfil -> telas). Conta de
// plataforma sempre passa. Usuario sem Perfil atribuido (legado) tambem passa -- quem decide
// bloquear e o admin da empresa, atribuindo um Perfil que nao inclua essa tela.
export function telaPermitidaGuard(telaChave: string): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!possuiSessao(authService)) {
      router.navigate(['/login']);
      return false;
    }

    if (authService.ehAdminDaPlataforma()) {
      return true;
    }

    const telas = authService.telasPermitidasSignal();
    if (telas === null) {
      return true; // legado: sem perfil atribuido, nao restringe.
    }

    if (telas.includes(telaChave)) {
      return true;
    }

    router.navigate(['/dashboard']);
    return false;
  };
}
