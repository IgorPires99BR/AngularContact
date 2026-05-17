import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // Método de Login para sua API C#
  login(credenciais: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, credenciais);
  }

  // Seus métodos de contatos permanecem abaixo...
  getContatosPorUsuario(usuarioId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/contato/obter-por-usuario/${usuarioId}`);
  }


}
