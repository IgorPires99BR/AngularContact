import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssistenteIaService } from './assistente-ia.service';

// Botao "✨" + popover de sugestoes, reutilizado em Chats/Templates/Flows/Disparador.
// O componente so cuida de chamar a IA e mostrar as opcoes -- quem usa decide o que
// fazer com a opcao escolhida (preencher um campo, so exibir etc).
@Component({
  selector: 'app-assistente-ia-botao',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assistente-ia-botao.html',
  styleUrls: ['./assistente-ia-botao.css'],
})
export class AssistenteIaBotaoComponent {
  private assistenteIa = inject(AssistenteIaService);

  @Input() label = '✨ Sugerir com IA';
  @Input() instrucao = '';
  @Input() contexto?: string;
  @Input() quantidade = 3;
  @Input() disabled = false;
  // Chats fica no rodapé da tela -- o popover precisa abrir pra cima em vez de pra
  // baixo, senão nasce fora da viewport.
  @Input() abrirParaCima = false;
  // Por padrão o popover se estende pra ESQUERDA a partir do botão (right:0). Em
  // botões que não estão perto da borda direita do próprio container (ex: Chats, onde
  // o botão fica no meio de uma barra larga), isso faz o popover invadir o painel
  // vizinho (lista de conversas) -- 'esquerda' inverte pra abrir pra DIREITA do botão.
  @Input() alinhamento: 'esquerda' | 'direita' = 'direita';
  @Output() escolhido = new EventEmitter<string>();

  aberto = signal(false);
  carregando = signal(false);
  opcoes = signal<string[]>([]);
  erro = signal('');

  alternar() {
    if (this.aberto()) {
      this.aberto.set(false);
      return;
    }
    this.aberto.set(true);
    this.buscarSugestoes();
  }

  fechar() {
    this.aberto.set(false);
  }

  private buscarSugestoes() {
    if (!this.instrucao) return;

    this.carregando.set(true);
    this.erro.set('');
    this.opcoes.set([]);

    this.assistenteIa.sugerir(this.instrucao, this.contexto, this.quantidade).subscribe({
      next: (opcoes) => {
        this.carregando.set(false);
        if (opcoes.length === 0) {
          this.erro.set('A IA não retornou nenhuma sugestão.');
          return;
        }
        this.opcoes.set(opcoes);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível consultar o assistente de IA agora.');
      }
    });
  }

  escolher(opcao: string) {
    this.escolhido.emit(opcao);
    this.aberto.set(false);
  }
}
