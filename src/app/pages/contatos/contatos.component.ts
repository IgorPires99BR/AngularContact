import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Contato { id: number; nome: string; tel: string; email: string; uid: string; }

@Component({
  selector: 'app-contatos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contatos.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class ContatosComponent {
  form = signal({ nome: '', tel: '', email: '', uid: '' });
  search = signal('');
  delId = signal('');
  response = signal('');
  delResponse = signal('');

  contatos = signal<Contato[]>([
    { id: 1, nome: 'João Silva',     tel: '5511999887766', email: 'joao@email.com',  uid: 'usr_001' },
    { id: 2, nome: 'Maria Rocha',    tel: '5521988776655', email: 'maria@email.com', uid: 'usr_001' },
    { id: 3, nome: 'Carlos Almeida', tel: '5511977665544', email: 'carlos@x.com',     uid: 'usr_002' },
  ]);

  update(field: string, value: string) { this.form.set({ ...this.form(), [field]: value }); }

  incluir() {
    const f = this.form();
    if (!f.nome || !f.tel) { this.response.set('❌ Nome e telefone obrigatórios'); return; }
    const id = Math.max(0, ...this.contatos().map(c => c.id)) + 1;
    this.contatos.set([...this.contatos(), { id, ...f }]);
    this.response.set(`✅ Contato incluído\n${JSON.stringify({ id, ...f }, null, 2)}`);
    this.form.set({ nome: '', tel: '', email: '', uid: '' });
  }

  excluir() {
    const id = +this.delId();
    if (!id) { this.delResponse.set('❌ Informe um ID válido'); return; }
    const before = this.contatos().length;
    this.contatos.set(this.contatos().filter(c => c.id !== id));
    this.delResponse.set(before > this.contatos().length
      ? `✅ Contato ${id} excluído`
      : `⚠ Contato ${id} não encontrado`);
    this.delId.set('');
  }
}
