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

  // Solicita o envio de uma nova senha por e-mail para o usuário
  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/forgot-password`, { email });
  }

  // Seus métodos de contatos permanecem abaixo...
  getContatosPorUsuario(usuarioId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/contato/obter-por-usuario/${usuarioId}`);
  }


}
