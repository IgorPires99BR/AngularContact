import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, WritableSignal, computed, inject, signal, untracked } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CAMPOS_DO_CONTATO, CampoContatoInfo } from './variavel-template';

// Por qual adquirente sai o Pix de cada empresa (conta dela ou da Contact Solution), para as telas
// de disparo mostrarem entre parênteses nas variáveis de Pix. Muda pouco: busca uma vez por
// empresa e guarda enquanto o app estiver aberto.
export interface ProvedorCobrancaEmpresa {
  cobrancaPixAtiva: boolean;
  provedor: string | null;
  nomeProvedor: string | null;
  contaDaEmpresa: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProvedorCobrancaService {
  private http = inject(HttpClient);
  private porEmpresa = new Map<string, WritableSignal<ProvedorCobrancaEmpresa | null>>();

  provedorDa(empresaId: Signal<string | null | undefined>): Signal<ProvedorCobrancaEmpresa | null> {
    return computed(() => {
      const id = empresaId();
      return id ? this.entrada(id)() : null;
    });
  }

  private entrada(empresaId: string): WritableSignal<ProvedorCobrancaEmpresa | null> {
    let atual = this.porEmpresa.get(empresaId);
    if (!atual) {
      const novo = signal<ProvedorCobrancaEmpresa | null>(null);
      atual = novo;
      this.porEmpresa.set(empresaId, novo);
      // Fora do computed que pediu: a resposta só atualiza o signal depois.
      untracked(() => this.http.get<ProvedorCobrancaEmpresa>(`${environment.apiUrl}/v2/empresa/${empresaId}/provedor-cobranca`).subscribe({
        next: (p) => novo.set(p),
        // Sem a informação as opções ficam com o nome sem parênteses; o disparo funciona igual.
        error: () => this.porEmpresa.delete(empresaId),
      }));
    }
    return atual;
  }
}

const CAMPOS_DE_PIX = new Set(['pixCopiaECola', 'linkPagamento']);

// Rótulos das variáveis com a adquirente: "Pix copia e cola (Mercado Pago, gerado no envio)".
export function camposComProvedor(provedor: ProvedorCobrancaEmpresa | null): CampoContatoInfo[] {
  if (!provedor) return CAMPOS_DO_CONTATO;

  const complemento = !provedor.cobrancaPixAtiva
    ? 'cobrança Pix desativada'
    : provedor.nomeProvedor
      ? `${provedor.nomeProvedor}${provedor.contaDaEmpresa ? ', conta da empresa' : ''}, gerado no envio`
      : 'gerado no envio';

  return CAMPOS_DO_CONTATO.map(c => CAMPOS_DE_PIX.has(c.chave)
    ? { ...c, rotulo: c.rotulo.replace('(gerado no envio)', `(${complemento})`) }
    : c);
}
