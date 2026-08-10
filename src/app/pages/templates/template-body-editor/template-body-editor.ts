import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-template-body-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-body-editor.html',
  styleUrls: ['../templates.css']
})
export class TemplateBodyEditorComponent {
  conteudo = input.required<string>();
  conteudoChange = output<string>();
  exemplos = input.required<{ value: string }[]>();
  exemplosChange = output<{ value: string }[]>();
  disabled = input(false);

  onConteudoChange(valor: string) {
    this.conteudoChange.emit(valor);

    const quantidade = (valor.match(/\{\{\d+\}\}/g) || []).length;
    const atuais = this.exemplos();
    this.exemplosChange.emit(Array.from({ length: quantidade }, (_, i) => atuais[i] ?? { value: '' }));
  }

  updateExemplo(index: number, valor: string) {
    const arr = [...this.exemplos()];
    arr[index] = { value: valor };
    this.exemplosChange.emit(arr);
  }
}
