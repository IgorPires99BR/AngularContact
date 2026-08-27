import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

// O e-mail de boas-vindas manda o cliente "trocar essa senha no primeiro acesso", mas nao
// existia tela para isso: a unica saida era "Esqueci minha senha", que sorteia OUTRA senha e
// manda por e-mail. O cliente nunca escolhia a propria senha.
@Component({
  selector: 'app-trocar-senha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trocar-senha.component.html',
  styleUrls: ['../shared-crud.css', './trocar-senha.component.css'],
})
export class TrocarSenhaComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly URL = `${environment.apiUrl}/usuario/trocar-senha`;

  form = signal({ senhaAtual: '', senhaNova: '', confirmacaoSenhaNova: '' });
  salvando = signal(false);
  erro = signal('');
  sucesso = signal(false);
  mostrarSenhas = signal(false);

  update(campo: 'senhaAtual' | 'senhaNova' | 'confirmacaoSenhaNova', valor: string) {
    this.form.update(f => ({ ...f, [campo]: valor }));
    // Mensagem de erro que sobra na tela depois que a pessoa ja corrigiu o campo faz
    // parecer que o problema continua.
    if (this.erro()) this.erro.set('');
  }

  // Espelha as regras do backend para o usuario nao descobrir o problema so depois de enviar.
  problema = computed(() => {
    const f = this.form();
    if (!f.senhaAtual) return 'Informe a senha atual.';
    if (!f.senhaNova) return 'Informe a nova senha.';
    if (f.senhaNova.length < 6) return 'A nova senha deve ter ao menos 6 caracteres.';
    if (f.senhaNova === f.senhaAtual) return 'A nova senha precisa ser diferente da atual.';
    if (f.confirmacaoSenhaNova !== f.senhaNova) return 'A confirmação não confere com a nova senha.';
    return '';
  });

  podeSalvar = computed(() => !this.problema() && !this.salvando());

  salvar() {
    if (!this.podeSalvar()) {
      this.erro.set(this.problema());
      return;
    }

    this.salvando.set(true);
    this.erro.set('');

    this.http.post(this.URL, this.form()).subscribe({
      next: () => {
        this.salvando.set(false);
        this.sucesso.set(true);
        this.form.set({ senhaAtual: '', senhaNova: '', confirmacaoSenhaNova: '' });
      },
      error: (err) => {
        this.salvando.set(false);
        this.erro.set(extrairMensagemErro(err, 'Não foi possível alterar a senha.'));
      },
    });
  }

  voltar() {
    this.router.navigate(['/dashboard']);
  }
}
