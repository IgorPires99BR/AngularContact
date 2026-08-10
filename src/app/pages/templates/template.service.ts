import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Template } from './template.models';

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/template`;

  listar(empresaId: string) {
    return this.http.get<Template[]>(`${this.API_URL}/Listar/${empresaId}`);
  }

  incluir(payload: unknown) {
    return this.http.post(`${this.API_URL}/incluir`, payload);
  }

  atualizar(id: string, payload: unknown) {
    return this.http.put(`${this.API_URL}/${id}`, payload);
  }

  excluir(id: string) {
    return this.http.delete(`${this.API_URL}/${id}`);
  }

  uploadMidiaExemplo(formData: FormData) {
    return this.http.post<{ handle: string }>(`${this.API_URL}/upload-midia-exemplo`, formData);
  }

  sincronizarComMeta(empresaId: string) {
    return this.http.put(`${this.API_URL}/AtualizaTemplateMeta/${empresaId}`, {});
  }
}
