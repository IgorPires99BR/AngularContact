import { Component, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/services/api';
import { AuthService } from '../../core/services/auth';
import { Globe3dComponent } from '../../shared/globe3d/globe3d';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Globe3dComponent],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private zone = inject(NgZone);
  private fb = inject(FormBuilder);

  // Formulário reativo: cada campo valida a si mesmo e expõe seu próprio estado de erro
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [true]
  });

  // Estado da UI
  loading = false;
  showPw = false;
  errorMsg = '';
  capsLockOn = false;

  get emailCtrl() {
    return this.form.controls.email;
  }

  get passwordCtrl() {
    return this.form.controls.password;
  }

  checkCapsLock(event: KeyboardEvent) {
    this.capsLockOn = event.getModifierState?.('CapsLock') ?? false;
  }

  async onLogin() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg = 'Verifique os campos destacados antes de continuar.';
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    const { email, password, rememberMe } = this.form.getRawValue();

    try {
      // Chamada para a API .NET Core. Login com sucesso sempre volta com o usuario no corpo
      // (a API responde erro de credencial invalida como HTTP 400, nunca como 200 "success:false").
      const res = await firstValueFrom(this.api.login({ email, password }));

      if (res && (res.idUsuario || res.IdUsuario || res.data?.idUsuario)) {
        // Extrai os dados se eles vierem encapsulados em uma propriedade 'data', ou usa o objeto direto
        const userData = res.data ? res.data : res;

        // Salva a sessão ativa de forma segura, respeitando a escolha de "Lembrar-me"
        this.auth.setSession(userData, !!rememberMe);

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

      // Tratamento de erros HTTP disparados pelo servidor (Ex: 401 Unauthorized, 400 Bad Request, ou API offline)
      if (err.status === 0) {
        this.errorMsg = 'Não foi possível conectar ao servidor de autenticação.';
      } else if (err.status === 401 || err.status === 400) {
        this.errorMsg = 'Credenciais incorretas.';
      } else {
        this.errorMsg = extrairMensagemErro(err, 'Erro ao realizar login. Tente novamente mais tarde.');
      }
    }
  }
}
