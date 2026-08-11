import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TemplateBotaoForm, TipoBotaoForm, rotuloTipoBotao } from '../template.models';

@Component({
  selector: 'app-template-botoes-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-botoes-editor.html',
  styleUrls: ['../templates.css']
})
export class TemplateBotoesEditorComponent {
  botoes = input.required<TemplateBotaoForm[]>();
  botoesChange = output<TemplateBotaoForm[]>();
  disabled = input(false);

  erro = signal('');
  rotulo = rotuloTipoBotao;

  // trackBy por índice: sem isso, cada tecla digitada recria o objeto do botão naquela
  // posição do array e o *ngFor (sem chave estável) destrói e recria o próprio <input>
  // do DOM a cada letra, tirando o foco/cursor de dentro dele.
  trackByIndex(index: number) {
    return index;
  }

  adicionarBotao(tipo: TipoBotaoForm) {
    if (this.botoes().length >= 3) {
      this.erro.set('A Meta permite no máximo 3 botões por template.');
      return;
    }
    if (tipo === 'PHONE_NUMBER' && this.botoes().some(b => b.tipo === 'PHONE_NUMBER')) {
      this.erro.set('Só é permitido 1 botão de telefone por template.');
      return;
    }
    if (tipo === 'COPY_CODE' && this.botoes().some(b => b.tipo === 'COPY_CODE')) {
      this.erro.set('Só é permitido 1 botão de código de cupom por template.');
      return;
    }

    this.erro.set('');
    this.botoesChange.emit([...this.botoes(), { tipo, texto: '' }]);
  }

  atualizarBotao(index: number, campo: keyof TemplateBotaoForm, valor: string) {
    this.botoesChange.emit(this.botoes().map((b, i) => i === index ? { ...b, [campo]: valor } : b));
  }

  atualizarTelefone(index: number, inputEl: HTMLInputElement) {
    const comSinal = inputEl.value.trim().startsWith('+') ? '+' : '';
    const digitos = inputEl.value.replace(/\D/g, '').slice(0, 15);
    const telefone = comSinal + digitos;
    inputEl.value = telefone;
    this.atualizarBotao(index, 'numeroTelefone', telefone);
  }

  removerBotao(index: number) {
    this.botoesChange.emit(this.botoes().filter((_, i) => i !== index));
  }
}
