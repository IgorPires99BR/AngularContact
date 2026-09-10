import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth';
import { UsuariosDaEmpresaComponent } from './usuarios-da-empresa.component';

// Pagina fina: so identifica a empresa de quem esta logado e delega a gestao de verdade para
// UsuariosDaEmpresaComponent (mesmo componente que a conta de plataforma usa dentro de
// Empresas, para gerenciar o time de QUALQUER cliente). Nada da logica de criar/editar/excluir
// usuario mudou aqui -- so mudou de onde.
@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, UsuariosDaEmpresaComponent],
  templateUrl: './usuarios.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class UsuariosComponent {
  private authService = inject(AuthService);
  empresaIdLogada = computed(() => this.authService.user()?.idEmpresa);
}
