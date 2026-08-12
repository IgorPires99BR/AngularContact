import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

// Servico compartilhado do assistente de IA (Gemini) -- usado por Chats, Templates,
// Flows e Disparador. O backend so sabe conversar com o Gemini; cada tela monta sua
// propria instrucao/contexto.
@Injectable({ providedIn: 'root' })
export class AssistenteIaService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/ia`;

  sugerir(instrucao: string, contexto?: string, quantidade: number = 3): Observable<string[]> {
    return this.http.post<{ value: { opcoes: string[] } }>(`${this.API_URL}/sugerir-texto`, {
      instrucao,
      contexto: contexto || null,
      quantidade
    }).pipe(
      map(res => res?.value?.opcoes || [])
    );
  }
}
