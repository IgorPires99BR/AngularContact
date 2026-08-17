import { Injectable, signal } from '@angular/core';

const CHAVE_STORAGE = 'cs_notificacao_sonora_ativa';

// Sem arquivo de audio: um "ding" curto gerado na hora via Web Audio API. Evita ter que
// empacotar e servir um asset so pra isso, e funciona igual em qualquer navegador.
@Injectable({ providedIn: 'root' })
export class NotificacaoSonoraService {
  ativa = signal(localStorage.getItem(CHAVE_STORAGE) !== 'false');

  private contexto?: AudioContext;

  alternar() {
    const novoValor = !this.ativa();
    this.ativa.set(novoValor);
    localStorage.setItem(CHAVE_STORAGE, String(novoValor));
    if (novoValor) this.tocar();
  }

  tocar() {
    if (!this.ativa()) return;

    try {
      this.contexto ??= new AudioContext();
      // Navegador bloqueia audio antes de qualquer interação do usuário na aba; se o
      // contexto estiver suspenso, so ignora -- nao vale travar nem mostrar erro por isso.
      if (this.contexto.state === 'suspended') return;

      const agora = this.contexto.currentTime;
      // Dois tons curtos (subindo), tipo "ding-dong" discreto de notificação de chat.
      [[880, agora], [1174, agora + 0.09]].forEach(([freq, inicio]) => {
        const osc = this.contexto!.createOscillator();
        const ganho = this.contexto!.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq as number;
        ganho.gain.setValueAtTime(0.001, inicio as number);
        ganho.gain.exponentialRampToValueAtTime(0.18, (inicio as number) + 0.015);
        ganho.gain.exponentialRampToValueAtTime(0.001, (inicio as number) + 0.22);
        osc.connect(ganho).connect(this.contexto!.destination);
        osc.start(inicio as number);
        osc.stop((inicio as number) + 0.24);
      });
    } catch {
      // Som é acessório -- qualquer falha (navegador sem suporte, autoplay bloqueado) é
      // silenciosamente ignorada, nunca deve quebrar a tela de Chats.
    }
  }
}
