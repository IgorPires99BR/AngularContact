import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';
import { LoginComponent } from './features/login/login';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  // 2. Rota de Login
  { path: 'login', component: LoginComponent },

  // Rotas Privadas (Usando a pasta Pages e o Shell como layout)
  {
    path: '',
    component: ShellComponent, // O Shell terá o seu Menu/Sidebar
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'chats',
        loadComponent: () => import('./pages/chats/chats.component').then(m => m.ChatsComponent)
      },
      {
        path: 'disparador',
        loadComponent: () => import('./pages/disparador/disparador.component').then(m => m.DisparadorComponent)
      },
      {
        path: 'flows',
        loadComponent: () => import('./pages/flows/flows.component').then(m => m.FlowsComponent)
      },
      {
        path: 'empresas',
        loadComponent: () => import('./pages/empresas/empresas.component').then(m => m.EmpresasComponent)
      },
      {
        path: 'contatos',
        loadComponent: () => import('./pages/contatos/contatos.component').then(m => m.ContatosComponent)
      },
      {
        path: 'numeros',
        loadComponent: () => import('./pages/numeros/numeros.component').then(m => m.NumerosComponent)
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./pages/usuarios/usuarios.component').then(m => m.UsuariosComponent)
      },
    ],
  },

  // Wildcard para evitar erros de rota
  { path: '**', redirectTo: 'login' },
];
