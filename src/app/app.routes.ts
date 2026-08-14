import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './auth-guard'; // Certifique-se de que o caminho está correto

// Layout, Landing e Login
import { ShellComponent } from './shell/shell.component';
import { LoginComponent } from './features/login/login';
import { ForgotPasswordComponent } from './features/forgot-password/forgot-password';
import { LandingComponent } from './features/landing/landing';
import { PrivacidadeComponent } from './features/legal/privacidade';
import { TermosComponent } from './features/legal/termos';
import { ExclusaoDadosComponent } from './features/legal/exclusao-dados';

// Componentes das Páginas (Eager Loading para evitar erros de chunk)
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ChatsComponent } from './pages/chats/chats.component';
import { DisparadorComponent } from './pages/disparador/disparador.component';
import { FlowsComponent } from './pages/flows/flows.component';
import { FlowBuilderComponent } from './pages/flow-builder/flow-builder';
import { EmpresasComponent } from './pages/empresas/empresas.component';
import { ContatosComponent } from './pages/contatos/contatos.component';
import { NumerosComponent } from './pages/numeros/numeros.component';
import { UsuariosComponent } from './pages/usuarios/usuarios.component';
import { TemplatesComponent } from './pages/templates/templates'; // <--- IMPORTADO AQUI
import { TemplatesMapaComponent } from './pages/templates-mapa/templates-mapa';
import { FlowsMapaComponent } from './pages/flows-mapa/flows-mapa';
import { RelatorioMensagensComponent } from './pages/relatorio-mensagens/relatorio-mensagens.component';
import { RelatorioFinanceiroComponent } from './pages/relatorio-financeiro/relatorio-financeiro.component';

export const routes: Routes = [
  // 1. Rota Pública: Landing Page (home) — porta de entrada comercial/pagamentos
  { path: '', pathMatch: 'full', component: LandingComponent },

  // 2. Rota Pública: O Login precisa estar fora do Guard para o usuário conseguir entrar
  { path: 'login', component: LoginComponent },
  { path: 'esqueci-senha', component: ForgotPasswordComponent },

  // Paginas juridicas: publicas de proposito. A analise do app na Meta exige a URL da
  // politica de privacidade e a de instrucoes de exclusao de dados abrindo sem login,
  // e o titular de dados costuma pedir exclusao justamente quando ja nao tem acesso.
  { path: 'privacidade', component: PrivacidadeComponent },
  { path: 'termos', component: TermosComponent },
  { path: 'exclusao-de-dados', component: ExclusaoDadosComponent },

  // 3. Rotas Protegidas: O Shell e todos os seus filhos agora exigem autenticação
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'chats', component: ChatsComponent },
      { path: 'disparador', component: DisparadorComponent },
      { path: 'flows', component: FlowsComponent },
      { path: 'flows/novo', component: FlowBuilderComponent },
      { path: 'flows/:id/editar', component: FlowBuilderComponent },
      { path: 'flows/mapa', component: FlowsMapaComponent },
      { path: 'empresas', component: EmpresasComponent, canActivate: [adminGuard] },
      { path: 'contatos', component: ContatosComponent },
      { path: 'numeros', component: NumerosComponent },
      { path: 'usuarios', component: UsuariosComponent, canActivate: [adminGuard] },
      { path: 'templates', component: TemplatesComponent }, // <--- INSERIDO DENTRO DO SHELL PROTEGIDO
      { path: 'templates/mapa', component: TemplatesMapaComponent },
      { path: 'relatorio', component: RelatorioMensagensComponent },
      { path: 'metricas', component: RelatorioFinanceiroComponent, canActivate: [adminGuard] },
    ],
  },

  // 4. Wildcard: Se o usuário tentar qualquer rota inexistente, volta para a home (Landing)
  { path: '**', redirectTo: '' },
];
