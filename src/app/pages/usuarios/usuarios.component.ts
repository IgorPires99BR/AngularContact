import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Perfil = 'admin' | 'operador' | 'viewer';
interface Usuario {
  id: number; nome: string; email: string; eid: string; perfil: Perfil; criadoEm: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class UsuariosComponent {
  form = signal<{ nome: string; email: string; senha: string; eid: string; perfil: Perfil }>(
    { nome: '', email: '', senha: '', eid: '', perfil: 'admin' }
  );
  searchId = signal('');
  searchResult = signal('Aguardando consulta...');
  response = signal('');

  usuarios = signal<Usuario[]>([
    { id: 1, nome: 'Igor Pires',      email: 'igor@contactsolution.com', eid: 'EMP_001', perfil: 'admin',     criadoEm: '12/04/2025' },
    { id: 2, nome: 'Ana Carolina',    email: 'ana@contactsolution.com',  eid: 'EMP_001', perfil: 'operador',  criadoEm: '15/04/2025' },
    { id: 3, nome: 'Marcos Oliveira', email: 'marcos@empresa-b.com',     eid: 'EMP_002', perfil: 'viewer',    criadoEm: '18/04/2025' },
  ]);

  update<K extends keyof ReturnType<typeof this.form>>(field: K, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  incluir() {
    const f = this.form();
    if (!f.nome || !f.email) { this.response.set('❌ Nome e e-mail obrigatórios'); return; }
    const id = Math.max(0, ...this.usuarios().map(u => u.id)) + 1;
    const novo = { id, nome: f.nome, email: f.email, eid: f.eid, perfil: f.perfil, criadoEm: new Date().toLocaleDateString('pt-BR') };
    this.usuarios.set([...this.usuarios(), novo]);
    this.response.set(`✅ Usuário criado\n${JSON.stringify({ ...novo, senha: '***' }, null, 2)}`);
    this.form.set({ nome: '', email: '', senha: '', eid: '', perfil: 'admin' });
  }

  buscar() {
    const id = +this.searchId();
    if (!id) { this.searchResult.set('❌ Informe um ID válido'); return; }
    const u = this.usuarios().find(x => x.id === id);
    this.searchResult.set(u ? JSON.stringify(u, null, 2) : `⚠ Usuário ${id} não encontrado`);
  }

  excluir(id: number) {
    this.usuarios.set(this.usuarios().filter(u => u.id !== id));
  }

  perfilBadge(p: Perfil) {
    return p === 'admin' ? 'badge-blue' : p === 'operador' ? 'badge-green' : 'badge-muted';
  }
}
