import { Component, signal, inject, OnInit } from '@angular/core'; // Adicionado OnInit
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Empresa {
  id: string; // Mudado para string, pois a API retorna um GUID
  nome: string;
  cnpj: string;
  email: string;
  telefone: string; // Padronizado com o Swagger
  dataCriacao: string; // Padronizado com o Swagger
}

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './empresas.component.html',
  styleUrls: ['../shared-crud.css'],
})
export class EmpresasComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly BASE_URL = 'https://localhost:7118/api/v2/empresa';

  form = signal({ nome: '', cnpj: '', email: '', tel: '' });
  response = signal('');

  // Inicializa o sinal com uma lista vazia
  empresas = signal<Empresa[]>([]);

  ngOnInit() {
    this.obterEmpresas();
  }

  obterEmpresas() {
    this.http.get<Empresa[]>(`${this.BASE_URL}/obter`).subscribe({
      next: (dados) => {
        this.empresas.set(dados);
      },
      error: (err) => {
        console.error('Erro ao buscar empresas:', err);
        this.response.set('❌ Erro ao carregar a lista de empresas.');
      }
    });
  }

  update(field: string, value: string) {
    this.form.set({ ...this.form(), [field]: value });
  }

  incluir() {
    const f = this.form();
    if (!f.nome || !f.cnpj) {
      this.response.set('❌ Nome e CNPJ são obrigatórios');
      return;
    }

    const payload = {
      nome: f.nome,
      email: f.email,
      telefone: f.tel,
      cnpj: f.cnpj
    };

    this.http.post(`${this.BASE_URL}/incluir`, payload).subscribe({
      next: () => {
        this.response.set('✅ Empresa cadastrada com sucesso!');
        this.form.set({ nome: '', cnpj: '', email: '', tel: '' });
        this.obterEmpresas(); // Recarrega a lista para trazer os dados atualizados do banco
      },
      error: (err) => {
        this.response.set('❌ Falha ao salvar empresa.');
      }
    });
  }

  excluir(id: string) {
    // Exemplo de como seria a chamada de exclusão (ajuste o endpoint se necessário)
    this.http.delete(`${this.BASE_URL}/excluir/${id}`).subscribe({
      next: () => this.obterEmpresas(),
      error: () => this.response.set('❌ Erro ao excluir.')
    });
  }
}
