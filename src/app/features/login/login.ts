import { Component, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/services/api';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
      // Chamada para API .NET Core conforme image_478c1e.png
      const res = await firstValueFrom(this.api.login({
        email: this.email,
        password: this.password
      }));

      // VALIDAR SE RECEBEMOS O OBJETO COMPLETO
      if (res && (res.idUsuario || res.IdUsuario)) {

        // CORREÇÃO: Passamos o objeto 'res' INTEIRO para o AuthService.
        // Isso garante que idEmpresa, email e role fiquem disponíveis para o Shell.
        this.auth.setSession(res);

        // Redireciona para o Dashboard
        this.zone.run(() => {
          this.router.navigate(['/dashboard']);
        });
      } else {
        this.errorMsg = 'Resposta do servidor inválida (Dados do usuário não encontrados).';
        this.loading = false;
      }

    } catch (err: any) {
      this.loading = false;

      // Fallback para desenvolvimento (API Offline)
      if (err.status === 0) {
        // Criamos um objeto mock com a mesma estrutura da imagem para não quebrar o Shell
        const mockUser = {
          idUsuario: '00000000-0000-0000-0000-000000000000',
          idEmpresa: '00000000-0000-0000-0000-000000000000',
          email: this.email,
          role: 'admin',
          status: 'success'
        };

        this.auth.setSession(mockUser);
        this.zone.run(() => this.router.navigate(['/dashboard']));
      } else {
        this.errorMsg = 'E-mail ou senha incorretos.';
      }
    }
  }
}
