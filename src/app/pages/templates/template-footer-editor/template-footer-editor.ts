import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-template-footer-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-footer-editor.html',
  styleUrls: ['../templates.css']
})
export class TemplateFooterEditorComponent {
  texto = input.required<string>();
  textoChange = output<string>();
  disabled = input(false);
}
