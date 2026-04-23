import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login'; // Ajuste o caminho se necessário
import { DashboardComponent } from './features/dashboard/dashboard';
import { ContatosComponent } from './features/contatos/contatos';
// Importe os demais componentes conforme necessário

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'app',
    children: [
      { path: 'dashboard', component: DashboardComponent }
    ]
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];
