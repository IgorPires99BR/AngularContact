import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ParametroEmpresa } from '../../shared/variaveis/variavel-template';

@Injectable({ providedIn: 'root' })
export class ParametroService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/parametro`;

  listar(empresaId: string) {
    return this.http.get<ParametroEmpresa[]>(`${this.API_URL}/obter-por-empresa/${empresaId}`);
  }

  incluir(payload: unknown) {
    return this.http.post<{ id: string }>(`${this.API_URL}/incluir`, payload);
  }

  atualizar(payload: unknown) {
    return this.http.put(`${this.API_URL}/alterar`, payload);
  }

  excluir(id: string) {
    return this.http.delete(`${this.API_URL}/excluir/${id}`);
  }
}
