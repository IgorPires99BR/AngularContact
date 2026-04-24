import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Empresa {
  id: number; nome: string; cnpj: string; email: string; tel: string; criadoEm: string;
}

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empresas.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class EmpresasComponent {
  form = signal({ nome: '', cnpj: '', email: '', tel: '' });
  response = signal('');

  empresas = signal<Empresa[]>([
    { id: 1, nome: 'Tech Solutions LTDA',  cnpj: '12.345.678/0001-90', email: 'contato@tech.com',     tel: '+55 11 9 8888-7777', criadoEm: '12/04/2025' },
    { id: 2, nome: 'Marketing Plus ME',    cnpj: '98.765.432/0001-10', email: 'hello@mktplus.com',    tel: '+55 21 9 7777-6666', criadoEm: '15/04/2025' },
    { id: 3, nome: 'Consultoria Premium',  cnpj: '55.444.333/0001-22', email: 'info@premium.com.br',  tel: '+55 31 9 6666-5555', criadoEm: '18/04/2025' },
  ]);

  update(field: string, value: string) {
    this.form.set({ ...this.form(), [field]: value });
  }

  incluir() {
    const f = this.form();
    if (!f.nome) { this.response.set('❌ Razão Social obrigatória'); return; }
    const id = Math.max(0, ...this.empresas().map(e => e.id)) + 1;
    this.empresas.set([...this.empresas(), { id, ...f, criadoEm: new Date().toLocaleDateString('pt-BR') }]);
    this.response.set(`✅ Empresa cadastrada\n${JSON.stringify({ id, ...f }, null, 2)}`);
    this.form.set({ nome: '', cnpj: '', email: '', tel: '' });
  }

  excluir(id: number) {
    this.empresas.set(this.empresas().filter(e => e.id !== id));
  }
}
