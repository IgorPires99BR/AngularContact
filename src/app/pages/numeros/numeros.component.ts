import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type NumStatus = 'ativo' | 'pendente' | 'bloqueado';
interface Numero {
  id: number; numero: string; descricao: string; pid: string; uid: string; status: NumStatus;
}

@Component({
  selector: 'app-numeros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './numeros.component.html',
  styleUrls: ['../shared-crud.css', './numeros.component.css'],
})
export class NumerosComponent {
  form = signal<{ numero: string; descricao: string; pid: string; uid: string; status: NumStatus }>(
    { numero: '', descricao: '', pid: '', uid: '', status: 'ativo' }
  );
  searchUid = signal('');
  response = signal('');

  numeros = signal<Numero[]>([
    { id: 1, numero: '5511999887766', descricao: 'WhatsApp Vendas',     pid: 'PID_001', uid: 'usr_001', status: 'ativo' },
    { id: 2, numero: '5511988776655', descricao: 'WhatsApp Suporte',    pid: 'PID_002', uid: 'usr_001', status: 'ativo' },
    { id: 3, numero: '5521977665544', descricao: 'WhatsApp Marketing',  pid: 'PID_003', uid: 'usr_002', status: 'pendente' },
    { id: 4, numero: '5531966554433', descricao: 'WhatsApp Cobrança',   pid: 'PID_004', uid: 'usr_002', status: 'bloqueado' },
    { id: 5, numero: '5541955443322', descricao: 'WhatsApp Premium',    pid: 'PID_005', uid: 'usr_003', status: 'ativo' },
  ]);

  ativos     = computed(() => this.numeros().filter(n => n.status === 'ativo').length);
  pendentes  = computed(() => this.numeros().filter(n => n.status === 'pendente').length);
  bloqueados = computed(() => this.numeros().filter(n => n.status === 'bloqueado').length);

  update<K extends keyof ReturnType<typeof this.form>>(field: K, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  incluir() {
    const f = this.form();
    if (!f.numero) { this.response.set('❌ Número obrigatório'); return; }
    const id = Math.max(0, ...this.numeros().map(n => n.id)) + 1;
    this.numeros.set([...this.numeros(), { id, ...f }]);
    this.response.set(`✅ Número cadastrado\n${JSON.stringify({ id, ...f }, null, 2)}`);
    this.form.set({ numero: '', descricao: '', pid: '', uid: '', status: 'ativo' });
  }

  excluir(id: number) {
    this.numeros.set(this.numeros().filter(n => n.id !== id));
  }

  badgeClass(s: NumStatus) {
    return s === 'ativo' ? 'badge-green' : s === 'pendente' ? 'badge-warn' : 'badge-danger';
  }
}
