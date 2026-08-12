import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

export interface NumeroOption {
  id: string;
  telefone: string;
  descricao: string;
}

// Seletor de numero reutilizado nas telas de Flows (lista, editor e mapa) -- empresas
// com mais de um WhatsApp conectado precisam escopar/vincular Flows por numero, e as
// tres telas usam exatamente a mesma lista e o mesmo formato de opcao.
@Component({
  selector: 'app-numero-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <select [ngModel]="value" (ngModelChange)="onChange($event)" [disabled]="carregando"
            [class.destacado]="destacado">
      <option value="">{{ opcaoTodos }}</option>
      <option *ngFor="let n of numeros" [value]="n.id">{{ n.telefone }}{{ n.descricao ? ' — ' + n.descricao : '' }}</option>
    </select>
  `,
  // O <select> vive dentro do template deste componente -- uma regra CSS escrita no
  // componente pai (ex: ".vinculado select") nunca alcança este elemento por causa do
  // encapsulamento de estilo do Angular (cada componente só estiliza o que está no
  // seu próprio template). O destaque precisa nascer aqui.
  styles: [`
    select {
      transition: border-color .15s, box-shadow .15s;
    }
    select.destacado {
      border-color: var(--violet) !important;
      box-shadow: 0 0 0 3px var(--violet-light);
    }
  `],
})
export class NumeroSelectorComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private userId = this.authService.usuarioIdSignal;

  private readonly API_URL = `${environment.apiUrl}/numero`;

  @Input() value: string = '';
  @Input() opcaoTodos: string = 'Todos os números';
  @Input() destacado: boolean = false;
  @Output() valueChange = new EventEmitter<string>();

  numeros: NumeroOption[] = [];
  carregando = true;

  ngOnInit() {
    const uid = this.userId();
    if (!uid) {
      this.carregando = false;
      return;
    }

    this.http.get<any[]>(`${this.API_URL}/ListarNumeros/${uid}`).subscribe({
      next: (res) => {
        this.numeros = (res || []).map(n => ({
          id: n.id || n.Id,
          telefone: n.telefone || n.Telefone || '',
          descricao: n.descricao || n.Descricao || ''
        }));
        this.carregando = false;
      },
      error: () => {
        this.numeros = [];
        this.carregando = false;
      }
    });
  }

  onChange(v: string) {
    this.value = v;
    this.valueChange.emit(v);
  }
}
