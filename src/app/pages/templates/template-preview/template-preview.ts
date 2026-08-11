import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderState, TemplateBotaoForm, rotuloTipoBotao } from '../template.models';
import { WhatsappFormatPipe } from '../../../shared/pipes/whatsapp-format.pipe';

@Component({
  selector: 'app-template-preview',
  standalone: true,
  imports: [CommonModule, WhatsappFormatPipe],
  templateUrl: './template-preview.html',
  styleUrls: ['../templates.css']
})
export class TemplatePreviewComponent {
  header = input.required<HeaderState>();
  textoPreview = input.required<string>();
  footerTexto = input<string>('');
  botoes = input.required<TemplateBotaoForm[]>();

  rotulo = rotuloTipoBotao;
}
