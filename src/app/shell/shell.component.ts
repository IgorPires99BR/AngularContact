import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MENU, PAGE_TITLES } from '../shared/menu';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.css'],
})
export class ShellComponent {
  menu = MENU;
  user = { name: 'Igor Pires', role: 'Administrador', initials: 'IP' };

  drawerOpen = signal(false);
  topTitle = signal('Dashboard');
  crumb = signal('Contact Solution › Dashboard');

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const id = e.urlAfterRedirects.split('?')[0].replace(/^\//, '') || 'dashboard';
        const title = PAGE_TITLES[id] ?? 'Dashboard';
        this.topTitle.set(title);
        this.crumb.set(`Contact Solution › ${title}`);
        this.drawerOpen.set(false); // fecha drawer ao navegar
      });
  }

  toggleDrawer() { this.drawerOpen.update(v => !v); }
  closeDrawer() { this.drawerOpen.set(false); }

  @HostListener('window:keydown.escape')
  onEsc() { this.closeDrawer(); }

  logout() { console.log('Sair'); }
}
