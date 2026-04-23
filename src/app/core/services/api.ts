import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Contato } from '../../features/contatos/contato.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // URL base da sua API C# (verifique a porta no seu Swagger)
  private readonly baseUrl = 'https://localhost:7118/api';

  constructor(private http: HttpClient) { }

  // Métodos mapeados do seu Swagger
  getContatosPorUsuario(usuarioId: number): Observable<Contato[]> {
    return this.http.get<Contato[]>(`${this.baseUrl}/contato/obter-por-usuario/${usuarioId}`);
  }

  incluirContato(contato: Contato): Observable<any> {
    return this.http.post(`${this.baseUrl}/contato/incluir`, contato);
  }

  excluirContato(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/contato/excluir/${id}`);
  }
}
