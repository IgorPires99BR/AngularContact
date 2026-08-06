import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css']
})
export class ForgotPasswordComponent {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  loading = false;
  submitted = false;
  errorMsg = '';

  get emailCtrl() {
    return this.form.controls.email;
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    try {
      await firstValueFrom(this.api.forgotPassword(this.form.getRawValue().email!));
      // O backend nunca revela se o e-mail existe ou não (proteção contra enumeração),
      // então sempre mostramos a mesma confirmação em caso de sucesso HTTP.
      this.submitted = true;
    } catch (err: any) {
      if (err.status === 0) {
        this.errorMsg = 'Não foi possível conectar ao servidor. Tente novamente mais tarde.';
      } else {
        this.errorMsg = 'Não foi possível processar sua solicitação agora. Tente novamente mais tarde.';
      }
    } finally {
      this.loading = false;
    }
  }
}
