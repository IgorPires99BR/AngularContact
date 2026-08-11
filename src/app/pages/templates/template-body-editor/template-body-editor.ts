import { Component, input, output, viewChild, ElementRef, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Emojis mais usados em mensagens comerciais (avisos, confirmações, promoções) --
// lista curta de propósito, é um atalho, não um seletor de emoji completo.
const EMOJIS_SUGERIDOS = [
  '😀', '😉', '😍', '😎', '🙂', '🤔', '👍', '🙏', '🎉', '🔥',
  '✅', '⭐', '❤️', '📦', '🚚', '💬', '📅', '⏰', '💰', '🛒',
  '🎁', '📢', '⚡', '✨', '👏', '🙌', '😊', '😢', '📌', '🚀'
];

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

  private textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('bodyTextarea');
  private emojiWrapRef = viewChild<ElementRef<HTMLElement>>('emojiWrap');

  emojis = EMOJIS_SUGERIDOS;
  mostrarEmojis = signal(false);

  // trackBy por índice: sem isso, cada tecla digitada recria o objeto do exemplo
  // naquela posição do array e o *ngFor (sem chave estável) destrói e recria o
  // próprio <input> do DOM a cada letra, tirando o foco/cursor de dentro dele.
  trackByIndex(index: number) {
    return index;
  }

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

  aplicarNegrito() {
    this.envolverSelecao('*');
  }

  aplicarItalico() {
    this.envolverSelecao('_');
  }

  alternarEmojis() {
    this.mostrarEmojis.update(v => !v);
  }

  inserirEmoji(emoji: string) {
    this.inserirNoCursor(emoji);
    this.mostrarEmojis.set(false);
  }

  @HostListener('document:click', ['$event'])
  onClickFora(event: MouseEvent) {
    if (!this.mostrarEmojis()) return;
    const wrap = this.emojiWrapRef()?.nativeElement;
    if (wrap && !wrap.contains(event.target as Node)) {
      this.mostrarEmojis.set(false);
    }
  }

  // Envolve o trecho selecionado no textarea com o marcador de formatação do WhatsApp --
  // não existe HTML na mensagem real, é essa sintaxe (*negrito*, _itálico_) que o
  // próprio app do WhatsApp interpreta na hora de exibir.
  private envolverSelecao(marcador: string) {
    const textarea = this.textareaRef()?.nativeElement;
    const valorAtual = this.conteudo();
    if (!textarea) return;

    const inicio = textarea.selectionStart ?? valorAtual.length;
    const fim = textarea.selectionEnd ?? valorAtual.length;
    const selecionado = valorAtual.slice(inicio, fim);

    // O WhatsApp só reconhece a formatação se o marcador encostar direto no texto, sem
    // espaço entre os dois -- um duplo-clique pra selecionar uma palavra às vezes inclui o
    // espaço seguinte, então o espaço precisa ficar por fora dos marcadores.
    const espacoInicial = selecionado.match(/^\s*/)?.[0] ?? '';
    const espacoFinal = selecionado.match(/\s*$/)?.[0] ?? '';
    const nucleo = selecionado.slice(espacoInicial.length, selecionado.length - espacoFinal.length);

    const novoValor = valorAtual.slice(0, inicio)
      + espacoInicial + marcador + nucleo + marcador + espacoFinal
      + valorAtual.slice(fim);
    this.onConteudoChange(novoValor);

    const novaPosicaoInicio = inicio + espacoInicial.length + marcador.length;
    this.restaurarSelecao(novaPosicaoInicio, novaPosicaoInicio + nucleo.length);
  }

  private inserirNoCursor(texto: string) {
    const textarea = this.textareaRef()?.nativeElement;
    const valorAtual = this.conteudo();
    if (!textarea) {
      this.onConteudoChange(valorAtual + texto);
      return;
    }

    const inicio = textarea.selectionStart ?? valorAtual.length;
    const fim = textarea.selectionEnd ?? valorAtual.length;
    const novoValor = valorAtual.slice(0, inicio) + texto + valorAtual.slice(fim);
    this.onConteudoChange(novoValor);

    const novaPosicao = inicio + texto.length;
    this.restaurarSelecao(novaPosicao, novaPosicao);
  }

  // O valor só volta pro textarea via [ngModel] no próximo ciclo de detecção de mudanças
  // -- precisa de um tick pra reposicionar cursor/foco depois que o DOM for atualizado.
  private restaurarSelecao(inicio: number, fim: number) {
    setTimeout(() => {
      const textarea = this.textareaRef()?.nativeElement;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(inicio, fim);
    });
  }
}
