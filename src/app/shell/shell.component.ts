import { Component, inject, computed, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth';
import { MENU } from '../shared/menu';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css' 
})
export class ShellComponent {
  private router = inject(Router);
  public auth = inject(AuthService);

  // Estado do Menu e Títulos
  menu = MENU;
  drawerOpen = signal(false);
  topTitle = signal('Dashboard');
  crumb = signal('Contact Solution / Principal');

  /**
   * COMPUTED: user
   * Renomeado de 'userDisplay' para 'user' para resolver o erro TS2339 no HTML.
   * Este sinal reage automaticamente quando o login é efetuado.
   */
  user = computed(() => {
    const data = this.auth.user();

    // Se não houver objeto completo, retorna o estado padrão
    if (!data || typeof data !== 'object') {
      return { name: 'Visitante', role: '', initials: '??' };
    }

    return {
      // Apresenta apenas o nome (extraído do email: igorpires97)
      name: data.email ? data.email.split('@')[0] : 'Usuário',
      // Apresenta apenas a role (formatada para o usuário)
      role: data.role === 'admin' ? 'Administrador' : 'Usuário',
      initials: this.auth.getInitials(data.email)
    };
  });

  // ════════════ MÉTODOS DE INTERAÇÃO ════════════

  toggleDrawer() {
    this.drawerOpen.update(v => !v);
  }

  closeDrawer() {
    this.drawerOpen.set(false);
  }

  /**
   * Efetua o logoff limpando o estado global e o armazenamento local
   */
  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
