import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api'; // Ajuste o caminho se necessário
import { Contato } from './contato.model';

@Component({
  selector: 'app-contatos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contatos.html',
  styleUrl: './contatos.css'
})
export class ContatosComponent implements OnInit {
  private apiService = inject(ApiService);
  listaContatos: Contato[] = [];

  ngOnInit() {
    // Exemplo buscando do usuário ID 1 (pode ser dinâmico depois)
    this.apiService.getContatosPorUsuario(1).subscribe({
      next: (dados) => this.listaContatos = dados,
      error: (err) => console.error('Erro ao carregar contatos:', err)
    });
  }
}
