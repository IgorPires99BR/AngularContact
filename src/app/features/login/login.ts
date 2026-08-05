import { Component, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/services/api';
import { AuthService } from '../../core/services/auth';
import { Globe3dComponent } from '../../shared/globe3d/globe3d';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, Globe3dComponent],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private zone = inject(NgZone);

  // Propriedades do Formulário
  email = '';
  password = '';

  // Estado da UI
  loading = false;
  showPw = false;
  errorMsg = '';

  async onLogin() {
    if (!this.email || !this.password) {
      this.errorMsg = 'Por favor, preencha todos os campos.';
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    try {
      // Chamada para a API .NET Core
      const res = await firstValueFrom(this.api.login({
        email: this.email,
        password: this.password
      }));

      // 1. Tratamento caso o seu backend use o padrão Response wrapper (com propriedade success/errors)
      // Se a requisição voltou com sucesso HTTP, mas o banco rejeitou as credenciais:
      if (res && res.success === false) {
        this.errorMsg = 'Credenciais incorretas.';
        this.loading = false;
        return;
      }

      // 2. Validação se o objeto do usuário foi realmente retornado com sucesso
      if (res && (res.idUsuario || res.IdUsuario || res.data?.idUsuario)) {

        // Extrai os dados se eles vierem encapsulados em uma propriedade 'data', ou usa o objeto direto
        const userData = res.data ? res.data : res;

        // Salva a sessão ativa de forma segura
        this.auth.setSession(userData);

        // Redireciona estritamente para o Dashboard
        this.zone.run(() => {
          this.router.navigate(['/dashboard']);
        });
      } else {
        this.errorMsg = 'Credenciais incorretas.';
        this.loading = false;
      }

    } catch (err: any) {
      this.loading = false;

      // 3. Tratamento de erros HTTP disparados pelo servidor (Ex: 401 Unauthorized, 400 Bad Request, ou API offline)
      if (err.status === 0) {
        this.errorMsg = 'Não foi possível conectar ao servidor de autenticação.';
      } else if (err.status === 401 || err.status === 400) {
        this.errorMsg = 'Credenciais incorretas.';
      } else {
        this.errorMsg = err.error?.message || 'Erro ao realizar login. Tente novamente mais tarde.';
      }
    }
  }
}
