import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './core/services/auth';

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
