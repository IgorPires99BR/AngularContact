import { Component, inject, computed, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth';
import { ChatNotificationService } from '../core/services/chat-notification';
import { MENU, getMenuByRole } from '../shared/menu';

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
  private chatNotification = inject(ChatNotificationService);

  // Estado do Menu e Títulos. O badge de "Chats Ativos" é sobrescrito com o total
  // real de não lidas (ver ChatNotificationService) em vez de um valor fixo.
  menu = computed(() => {
    const userData = this.auth.user();
    const secoes = getMenuByRole(userData?.role);
    const totalNaoLidas = this.chatNotification.totalNaoLidas();

    return secoes.map(secao => ({
      ...secao,
      items: secao.items.map(item =>
        item.id === 'chats'
          ? { ...item, badge: totalNaoLidas > 0 ? totalNaoLidas : undefined }
          : item
      )
    }));
  });

  constructor() {
    this.chatNotification.carregarTotalNaoLidas();

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.aplicarTitulo(e.urlAfterRedirects);
        // No celular a sidebar e um drawer sobreposto: sem isto ela continuava
        // cobrindo a tela depois de tocar num item do menu.
        this.closeDrawer();
      });

    // O primeiro carregamento nao dispara NavigationEnd a tempo de ser ouvido aqui.
    this.aplicarTitulo(this.router.url);
  }

  drawerOpen = signal(false);
  topTitle = signal('Contact Solution');
  crumb = signal('Contact Solution');

  // Telas que nao estao no menu porque so se chega nelas a partir de outra.
  private static readonly TITULOS_FORA_DO_MENU: Record<string, [string, string]> = {
    '/flows/novo':     ['Novo Flow',          'Flows / Novo'],
    '/flows/mapa':     ['Mapa de Flows',      'Flows / Mapa'],
    '/templates/mapa': ['Mapa de Templates',  'Templates / Mapa'],
  };

  /**
   * Antes topTitle era um signal fixo em 'Dashboard' que nunca era atualizado, entao
   * TODA tela se anunciava como "Dashboard" na topbar. O nome sai do mesmo MENU que
   * desenha a sidebar, de proposito: uma segunda lista de rotas -> titulos sairia do
   * ar na primeira tela nova que alguem adicionasse.
   */
  private aplicarTitulo(url: string) {
    const rota = url.split('?')[0].split('#')[0];

    const fora = ShellComponent.TITULOS_FORA_DO_MENU[rota];
    if (fora) {
      this.topTitle.set(fora[0]);
      this.crumb.set(`Contact Solution / ${fora[1]}`);
      return;
    }

    if (/^\/flows\/[^/]+\/editar$/.test(rota)) {
      this.topTitle.set('Editar Flow');
      this.crumb.set('Contact Solution / Flows / Editar');
      return;
    }

    // MENU completo, e nao this.menu(): o menu do componente vem filtrado por papel,
    // entao um operador que abrisse /dashboard (rota sem guard, so ausente da barra
    // dele) via a topbar cair no nome generico. O titulo descreve a rota, nao a
    // permissao de quem esta olhando.
    const candidatos = MENU
      .flatMap(secao => secao.items.map(item => ({ item, secao: secao.label })))
      .filter(({ item }) => rota === item.route || rota.startsWith(item.route + '/'))
      // Mais especifico primeiro: senao /flows/mapa casaria com /flows.
      .sort((a, b) => b.item.route.length - a.item.route.length);

    if (candidatos.length) {
      const { item, secao } = candidatos[0];
      this.topTitle.set(item.label);
      this.crumb.set(`Contact Solution / ${secao} / ${item.label}`);
    } else {
      this.topTitle.set('Contact Solution');
      this.crumb.set('Contact Solution');
    }
  }

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
