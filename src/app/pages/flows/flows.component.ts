import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type StepType = 'msg' | 'input' | 'cond' | 'end';
interface Step {
  id: number;
  type: StepType;
  message: string;
  variable?: string;
}
interface Flow {
  id: number;
  name: string;
  trigger: string;
  status: 'ativo' | 'inativo' | 'teste';
  clients: number;
  steps: Step[];
}

@Component({
  selector: 'app-flows',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './flows.component.html',
  styleUrls: ['./flows.component.css'],
})
export class FlowsComponent {
  Math = Math;  // expor no template
  tab = signal<'builder' | 'monitor' | 'saved'>('builder');

  flows = signal<Flow[]>([
    {
      id: 1, name: 'Atendimento Inicial', trigger: 'oi, olá, bom dia', status: 'ativo', clients: 87,
      steps: [
        { id: 1, type: 'msg',   message: 'Olá! Bem-vindo à Contact Solution 👋' },
        { id: 2, type: 'input', message: 'Qual seu nome?', variable: 'nome' },
        { id: 3, type: 'msg',   message: 'Prazer, {{nome}}! Como posso ajudar?' },
        { id: 4, type: 'end',   message: 'Encerrar atendimento' },
      ],
    },
    { id: 2, name: 'Qualificação Lead',   trigger: 'quero saber',  status: 'ativo',   clients: 54, steps: [] },
    { id: 3, name: 'Pós-Venda',           trigger: 'recebido',     status: 'ativo',   clients: 12, steps: [] },
    { id: 4, name: 'Carrinho Abandonado', trigger: '',             status: 'inativo', clients: 0,  steps: [] },
    { id: 5, name: 'Boas-vindas Premium', trigger: 'premium',      status: 'teste',   clients: 3,  steps: [] },
  ]);

  selectedId = signal<number>(1);
  selected = () => this.flows().find(f => f.id === this.selectedId()) ?? this.flows()[0];

  stepTypes: { value: StepType; label: string }[] = [
    { value: 'msg',   label: 'Mensagem' },
    { value: 'input', label: 'Capturar Input' },
    { value: 'cond',  label: 'Condição' },
    { value: 'end',   label: 'Encerrar' },
  ];

  stepLabel(t: StepType) {
    return this.stepTypes.find(s => s.value === t)?.label ?? t;
  }

  select(id: number) { this.selectedId.set(id); }

  newFlow() {
    const id = Math.max(...this.flows().map(f => f.id)) + 1;
    const f: Flow = { id, name: 'Novo Flow', trigger: '', status: 'inativo', clients: 0, steps: [] };
    this.flows.set([f, ...this.flows()]);
    this.selectedId.set(id);
    this.tab.set('builder');
  }

  addStep() {
    const f = this.selected();
    const id = (f.steps[f.steps.length - 1]?.id ?? 0) + 1;
    f.steps.push({ id, type: 'msg', message: '' });
    this.flows.set([...this.flows()]);
  }
  removeStep(stepId: number) {
    const f = this.selected();
    f.steps = f.steps.filter(s => s.id !== stepId);
    this.flows.set([...this.flows()]);
  }

  updateFlowField(field: keyof Flow, value: string) {
    const f = this.selected();
    (f as any)[field] = value;
    this.flows.set([...this.flows()]);
  }
  updateStep(stepId: number, partial: Partial<Step>) {
    const f = this.selected();
    f.steps = f.steps.map(s => s.id === stepId ? { ...s, ...partial } : s);
    this.flows.set([...this.flows()]);
  }

  statusBadge(s: Flow['status']) {
    return s === 'ativo' ? 'badge-green' : s === 'teste' ? 'badge-warn' : 'badge-muted';
  }
  statusLabel(s: Flow['status']) {
    return s === 'ativo' ? 'Ativo' : s === 'teste' ? 'Teste' : 'Inativo';
  }
}
