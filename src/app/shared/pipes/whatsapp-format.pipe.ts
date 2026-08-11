import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Converte a sintaxe de formatação de texto do WhatsApp (*negrito*, _itálico_, ~riscado~)
// em HTML, pra prévia do template refletir como a mensagem realmente aparece no app.
@Pipe({ name: 'whatsappFormat', standalone: true })
export class WhatsappFormatPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(texto: string | null | undefined): SafeHtml {
    if (!texto) return '';

    const escapado = texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const formatado = escapado
      .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
      .replace(/_([^_\n]+)_/g, '<i>$1</i>')
      .replace(/~([^~\n]+)~/g, '<s>$1</s>')
      .replace(/\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(formatado);
  }
}
