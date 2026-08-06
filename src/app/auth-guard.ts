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
