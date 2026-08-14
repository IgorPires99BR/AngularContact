import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

interface GastoEmpresaMes {
  empresaId: string;
  nomeEmpresa: string;
  ano: number;
  mes: number;
  categoria: string;
  quantidade: number;
  gastoEstimado: number;
}

interface EngajamentoEmpresa {
  empresaId: string;
  nomeEmpresa: string;
  enviados: number;
  visualizaram: number;
  responderam: number;
  naoResponderam: number;
}

interface PrecoCategoria {
  categoria: string;
  precoUnitario: number;
  moeda: string;
}

interface GastoAgrupado {
  chave: string;
  nomeEmpresa: string;
  ano: number;
  mes: number;
  categorias: { categoria: string; quantidade: number; gasto: number }[];
  gastoTotal: number;
}

const NOMES_MES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

@Component({
  selector: 'app-relatorio-financeiro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './relatorio-financeiro.component.html',
  styleUrls: ['../shared-crud.css', './relatorio-financeiro.component.css'],
})
export class RelatorioFinanceiroComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/relatorio`;

  carregando = signal(false);
  erro = signal('');

  dataInicio = signal('');
  dataFim = signal('');

  gastos = signal<GastoEmpresaMes[]>([]);
  engajamento = signal<EngajamentoEmpresa[]>([]);
  precos = signal<PrecoCategoria[]>([]);
  precosEmEdicao = signal<Record<string, number>>({});
  salvandoPreco = signal<string | null>(null);

  gastoTotalPeriodo = computed(() => this.gastos().reduce((soma, g) => soma + g.gastoEstimado, 0));

  gastosAgrupados = computed<GastoAgrupado[]>(() => {
    const mapa = new Map<string, GastoAgrupado>();
    for (const g of this.gastos()) {
      const chave = `${g.empresaId}-${g.ano}-${g.mes}`;
      let grupo = mapa.get(chave);
      if (!grupo) {
        grupo = { chave, nomeEmpresa: g.nomeEmpresa, ano: g.ano, mes: g.mes, categorias: [], gastoTotal: 0 };
        mapa.set(chave, grupo);
      }
      grupo.categorias.push({ categoria: g.categoria, quantidade: g.quantidade, gasto: g.gastoEstimado });
      grupo.gastoTotal += g.gastoEstimado;
    }
    return Array.from(mapa.values()).sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes) || a.nomeEmpresa.localeCompare(b.nomeEmpresa));
  });

  ngOnInit() {
    this.buscar();
  }

  mesLabel(mes: number, ano: number): string {
    return `${NOMES_MES[mes]}/${ano}`;
  }

  buscar() {
    this.carregando.set(true);
    this.erro.set('');

    let params = new HttpParams();
    if (this.dataInicio()) params = params.set('dataInicio', this.dataInicio());
    if (this.dataFim()) params = params.set('dataFim', this.dataFim());

    this.http.get<{ gastos: GastoEmpresaMes[] }>(`${this.API_URL}/financeiro`, { params })
      .subscribe({
        next: (res) => this.gastos.set(res.gastos || []),
        error: (err) => this.erro.set(extrairMensagemErro(err, 'Erro ao carregar o relatório financeiro.'))
      });

    this.http.get<{ empresas: EngajamentoEmpresa[] }>(`${this.API_URL}/engajamento`, { params })
      .subscribe({
        next: (res) => {
          this.engajamento.set(res.empresas || []);
          this.carregando.set(false);
        },
        error: (err) => {
          this.erro.set(extrairMensagemErro(err, 'Erro ao carregar o relatório de engajamento.'));
          this.carregando.set(false);
        }
      });

    this.http.get<{ precos: PrecoCategoria[] }>(`${this.API_URL}/precos-categoria`)
      .subscribe({
        next: (res) => {
          this.precos.set(res.precos || []);
          const edicao: Record<string, number> = {};
          for (const p of res.precos || []) edicao[p.categoria] = p.precoUnitario;
          this.precosEmEdicao.set(edicao);
        },
        error: () => {}
      });
  }

  limparFiltroData() {
    this.dataInicio.set('');
    this.dataFim.set('');
    this.buscar();
  }

  atualizarPrecoEmEdicao(categoria: string, valor: string) {
    this.precosEmEdicao.update(atual => ({ ...atual, [categoria]: Number(valor) }));
  }

  salvarPreco(categoria: string) {
    const valor = this.precosEmEdicao()[categoria] ?? 0;
    this.salvandoPreco.set(categoria);

    this.http.put<{ precos: PrecoCategoria[] }>(`${this.API_URL}/precos-categoria/${categoria}`, { precoUnitario: valor })
      .subscribe({
        next: (res) => {
          this.precos.set(res.precos || []);
          this.salvandoPreco.set(null);
          this.buscar(); // preco mudou, o gasto estimado precisa ser recalculado na tela
        },
        error: (err) => {
          this.erro.set(extrairMensagemErro(err, 'Erro ao salvar o preço da categoria.'));
          this.salvandoPreco.set(null);
        }
      });
  }

  categoriaLabel(categoria: string): string {
    const mapa: Record<string, string> = {
      MARKETING: '📣 Marketing',
      UTILITY: '🔧 Utility',
      AUTHENTICATION: '🔐 Authentication',
      SEM_CATEGORIA: 'Sem categoria'
    };
    return mapa[categoria] || categoria;
  }

  pct(parte: number, total: number): number {
    if (!total) return 0;
    return Math.round((Math.max(parte, 0) / total) * 100);
  }
}
