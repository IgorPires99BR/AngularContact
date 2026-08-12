import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssistenteIaBotaoComponent } from '../../../shared/assistente-ia/assistente-ia-botao';

export interface Step {
  id: string;
  ordem: number;
  tipoStep: string;
  mensagemPergunta: string;
  variavelSaida?: string;
  gatilhoResposta?: string;
  proximaEtapaId?: string | null;
  ehEtapaInicial?: boolean;
  templateId?: string;
}

// Editor das etapas de um Flow, extraido do antigo flows.component.ts (que concentrava
// lista + criacao + monitor + etapas num unico componente) pra ficar reutilizavel e a
// tela de builder nao virar outro monolito. Mesmo padrao de decomposicao ja usado pelos
// editores de Template (template-header-editor, template-body-editor etc.).
@Component({
  selector: 'app-flow-etapas-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, AssistenteIaBotaoComponent],
  templateUrl: './flow-etapas-editor.html',
  styleUrls: ['./flow-etapas-editor.css'],
})
export class FlowEtapasEditorComponent {
  @Input() etapas: Step[] = [];
  @Output() etapasChange = new EventEmitter<Step[]>();
  // Contexto opcional pra IA entender o objetivo do flow ao sugerir o texto de uma etapa.
  @Input() flowNome = '';
  @Input() flowDescricao = '';

  stepTypes = [
    { value: 'Mensagem', label: 'Mensagem', chipLabel: '+ Mensagem', icon: '💬', hint: 'O bot envia um texto pro cliente.' },
    { value: 'Capturar Input', label: 'Capturar Input', chipLabel: '+ Capturar Dado', icon: '✍️', hint: 'Espera a resposta do cliente e guarda numa variável.' },
    { value: 'Condição', label: 'Condição', chipLabel: '+ Condição', icon: '🔀', hint: 'Só avança se a resposta bater com o gatilho configurado.' },
    { value: 'Encerrar', label: 'Encerrar', chipLabel: '+ Encerrar Conversa', icon: '🏁', hint: 'Finaliza o flow — nenhuma etapa depois dela roda.' },
  ];

  addStep(tipo: string = 'Mensagem') {
    const novaEtapa: Step = {
      id: crypto.randomUUID(),
      ordem: this.etapas.length + 1,
      tipoStep: tipo,
      mensagemPergunta: '',
      variavelSaida: '',
      ehEtapaInicial: this.etapas.length === 0,
      gatilhoResposta: 'Avancar',
      proximaEtapaId: null
    };
    this.emitir(this.recalcularCadeia([...this.etapas, novaEtapa]));
  }

  removeStep(stepId: string) {
    this.emitir(this.recalcularCadeia(this.etapas.filter(s => s.id !== stepId)));
  }

  moveStep(stepId: string, direcao: -1 | 1) {
    const etapas = [...this.etapas];
    const idx = etapas.findIndex(s => s.id === stepId);
    const novoIdx = idx + direcao;
    if (idx < 0 || novoIdx < 0 || novoIdx >= etapas.length) return;

    [etapas[idx], etapas[novoIdx]] = [etapas[novoIdx], etapas[idx]];
    this.emitir(this.recalcularCadeia(etapas));
  }

  updateStep(stepId: string, partial: Partial<Step>) {
    this.emitir(this.etapas.map(s => s.id === stepId ? { ...s, ...partial } : s));
  }

  // Sempre que a ordem visual muda (adicionar/remover/mover), refaz a cadeia inteira:
  // ordem sequencial, ehEtapaInicial só na primeira, e proximaEtapaId apontando pra
  // etapa seguinte (o builder hoje só monta flows lineares, sem ramificação).
  private recalcularCadeia(etapas: Step[]): Step[] {
    return etapas.map((s, i) => ({
      ...s,
      ordem: i + 1,
      ehEtapaInicial: i === 0,
      proximaEtapaId: i < etapas.length - 1 ? etapas[i + 1].id : null
    }));
  }

  private emitir(etapas: Step[]) {
    this.etapas = etapas;
    this.etapasChange.emit(etapas);
  }

  // Sem trackBy, o *ngFor dos steps usa a identidade do objeto pra rastrear cada item.
  // updateStep() troca o objeto do step editado por uma cópia nova, então a cada tecla
  // digitada o Angular via um objeto "diferente" naquela posição e destruía/recriava o
  // <textarea> do DOM, tirando o foco e a seleção de dentro dele.
  trackByStepId(_index: number, step: Step) {
    return step.id;
  }

  stepIcon(t: string) {
    return this.stepTypes.find(s => s.value === t)?.icon ?? '💬';
  }

  stepHint(t: string) {
    return this.stepTypes.find(s => s.value === t)?.hint ?? '';
  }

  instrucaoIa(tipoStep: string): string {
    const tipo = tipoStep === 'Capturar Input' ? 'que pede um dado ao cliente (ex: nome, e-mail)' : `do tipo "${tipoStep}"`;
    return `Sugira a mensagem que um bot de atendimento deve enviar numa etapa ${tipo} de um fluxo de conversa automatizado.`;
  }

  contextoIa(step: Step): string {
    const partes: string[] = [];
    if (this.flowNome) partes.push(`Nome do flow: ${this.flowNome}`);
    if (this.flowDescricao) partes.push(`Descrição do flow: ${this.flowDescricao}`);
    if (step.mensagemPergunta) partes.push(`Texto atual da etapa: ${step.mensagemPergunta}`);
    return partes.join('\n');
  }

  stepAccentClass(step: Step) {
    if (step.ehEtapaInicial) return 'step-accent-inicio';
    if (step.tipoStep === 'Encerrar') return 'step-accent-fim';
    return 'step-accent-meio';
  }
}
