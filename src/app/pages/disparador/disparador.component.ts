import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Contato { id: number; name: string; phone: string; color: string; checked: boolean; }
interface Param { type: 'text' | 'currency' | 'date_time'; value: string; }

@Component({
  selector: 'app-disparador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './disparador.component.html',
  styleUrls: ['./disparador.component.css'],
})
export class DisparadorComponent {
  search = signal('');
  template = signal('');
  lang = signal('pt_BR');
  phoneId = signal('');
  token = signal('');
  params = signal<Param[]>([{ type: 'text', value: '' }]);
  responseText = signal('');

  contatos = signal<Contato[]>([
    { id: 1, name: 'João Silva',     phone: '5511999887766', color: 'linear-gradient(135deg,#3D6EE8,#4B7BFF)', checked: false },
    { id: 2, name: 'Maria Rocha',    phone: '5521988776655', color: 'linear-gradient(135deg,#F59E0B,#FBBF24)', checked: false },
    { id: 3, name: 'Carlos Almeida', phone: '5511977665544', color: 'linear-gradient(135deg,#22C55E,#4ADE80)', checked: true  },
    { id: 4, name: 'Paula Lima',     phone: '5531966554433', color: 'linear-gradient(135deg,#6366F1,#8B5CF6)', checked: false },
    { id: 5, name: 'Ricardo Fontes', phone: '5541955443322', color: 'linear-gradient(135deg,#EC4899,#F472B6)', checked: true  },
    { id: 6, name: 'Ana Martins',    phone: '5551944332211', color: 'linear-gradient(135deg,#06B6D4,#22D3EE)', checked: false },
    { id: 7, name: 'Bruno Costa',    phone: '5511933221100', color: 'linear-gradient(135deg,#F43F5E,#FB7185)', checked: false },
  ]);

  filteredContatos = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.contatos();
    return this.contatos().filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  });

  selectedCount = computed(() => this.contatos().filter(c => c.checked).length);

  payload = computed(() => {
    const tpl = this.template().trim() || 'template_name';
    const sel = this.contatos().filter(c => c.checked);
    return {
      template: tpl,
      language: { code: this.lang() },
      recipients: sel.map(c => c.phone),
      components: [
        {
          type: 'body',
          parameters: this.params().map(p => ({ type: p.type, text: p.value })),
        },
      ],
    };
  });

  payloadJson = computed(() => JSON.stringify(this.payload(), null, 2));

  toggle(c: Contato) {
    c.checked = !c.checked;
    this.contatos.set([...this.contatos()]);
  }
  selAll()  { this.contatos.set(this.contatos().map(c => ({ ...c, checked: true }))); }
  selNone() { this.contatos.set(this.contatos().map(c => ({ ...c, checked: false }))); }

  addParam() { this.params.set([...this.params(), { type: 'text', value: '' }]); }
  removeParam(i: number) { this.params.set(this.params().filter((_, idx) => idx !== i)); }
  updateParam(i: number, partial: Partial<Param>) {
    const arr = [...this.params()];
    arr[i] = { ...arr[i], ...partial };
    this.params.set(arr);
  }

  disparar() {
    this.responseText.set(`✅ Disparo simulado para ${this.selectedCount()} contatos\n\n${this.payloadJson()}`);
  }
  limpar() {
    this.template.set(''); this.phoneId.set(''); this.token.set('');
    this.params.set([{ type: 'text', value: '' }]); this.responseText.set('');
    this.selNone();
  }
}
