import { Pipe, PipeTransform } from '@angular/core';

// Defesa extra: o backend ja formata o Conteudo do HistoricoDisparo antes de
// mandar pro chat (MensagemFormatter.cs), mas qualquer payload que chegue cru
// (ex.: JSON de template vazando por outro caminho) passa por aqui tambem,
// pra nunca aparecer JSON bruto pro usuario final.
@Pipe({ name: 'templateMessage', standalone: true })
export class TemplateMessagePipe implements PipeTransform {
  transform(texto: string | null | undefined): string {
    if (!texto) return '';

    const semEspacos = texto.trim();
    if (!semEspacos.startsWith('{')) return texto;

    try {
      const json = JSON.parse(semEspacos);
      const payload = json.PayloadEnvio ? JSON.parse(json.PayloadEnvio) : json;
      const nomeTemplate = payload?.template?.name;

      if (nomeTemplate) return `📄 [Template: ${nomeTemplate}]`;
    } catch {
      // Nao era JSON de template: cai no fallback abaixo
    }

    return texto;
  }
}
