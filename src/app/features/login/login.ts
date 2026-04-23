import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  email = '';
  password = '';
  rememberMe = false;
  loading = false;
  errorMsg = '';
  showPw = false;

  features = [
    { icon: '📤', label: 'Disparos em massa via Meta API' },
    { icon: '🔄', label: 'Flows automáticos de conversa' },
    { icon: '🎯', label: 'Captura e gestão de leads' },
    { icon: '📊', label: 'Dashboard em tempo real' },
  ];

  stats = [
    { val: '99.8%', label: 'Uptime garantido' },
    { val: '+5M', label: 'Msgs/mês' },
    { val: '<1s', label: 'Latência' },
  ];

  constructor(private router: Router) { }

  async onLogin() {
    if (!this.email || !this.password) { this.errorMsg = 'Preencha todos os campos.'; return; }
    this.loading = true;
    this.errorMsg = '';

    try {
      const res = await fetch('https://localhost:7118/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, password: this.password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('cs_token', data.token || '');
        localStorage.setItem('cs_user', JSON.stringify({ nome: data.nome || this.email, id: data.usuarioId }));
        this.router.navigate(['app/dashboard']);
      } else {
        this.errorMsg = 'E-mail ou senha incorretos.';
      }
    } catch {
      // DEV MODE: bypass when API offline
      localStorage.setItem('cs_token', 'dev_token');
      localStorage.setItem('cs_user', JSON.stringify({ nome: 'Igor Pires', id: '1' }));
      this.router.navigate(['/app/dashboard']);
    } finally {
      this.loading = false;
    }
  }
}
