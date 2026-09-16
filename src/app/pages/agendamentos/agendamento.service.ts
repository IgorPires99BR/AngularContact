import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Agendamento, AgendamentoDetalhe, AgendamentoExecucao } from './agendamento.models';

@Injectable({ providedIn: 'root' })
export class AgendamentoService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/agendamento`;

  listar(empresaId: string) {
    return this.http.get<Agendamento[]>(`${this.API_URL}/listar/${empresaId}`);
  }

  obter(id: string) {
    return this.http.get<AgendamentoDetalhe>(`${this.API_URL}/${id}`);
  }

  incluir(payload: unknown) {
    return this.http.post<{ id: string }>(`${this.API_URL}/incluir`, payload);
  }

  atualizar(payload: unknown) {
    return this.http.put(`${this.API_URL}/alterar`, payload);
  }

  alterarStatus(id: string, ativo: boolean) {
    return this.http.put(`${this.API_URL}/${id}/status`, { ativo });
  }

  excluir(id: string) {
    return this.http.delete(`${this.API_URL}/${id}`);
  }

  listarExecucoes(id: string) {
    return this.http.get<AgendamentoExecucao[]>(`${this.API_URL}/${id}/execucoes`);
  }
}
