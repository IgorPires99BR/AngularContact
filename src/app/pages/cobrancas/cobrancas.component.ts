import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

interface Assinatura {
  id: string;
  empresaId: string;
  nomeEmpresa: string;
  emailComprador?: string;
  plano: string;
  status: string;
  valor?: number;
  dataInicio: string;
  dataProximaCobranca?: string;
  dataCancelamento?: string;
  ultimoEvento?: string;
  dataUltimoEvento?: string;
}

interface RespostaAssinaturas {
  assinaturas: Assinatura[];
  totalAtivas: number;
  receitaMensalEstimada: number;
}

@Component({
  selector: 'app-cobrancas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cobrancas.component.html',
  styleUrls: ['../shared-crud.css', './cobrancas.component.css'],
})
export class CobrancasComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/cobranca/assinaturas`;

  assinaturas = signal<Assinatura[]>([]);
  totalAtivas = signal(0);
  receita = signal(0);
  carregando = signal(true);
  erro = signal('');
  busca = signal('');

  filtradas = computed(() => {
    const termo = this.busca().toLowerCase().trim();
    if (!termo) return this.assinaturas();
    return this.assinaturas().filter(a =>
      a.nomeEmpresa?.toLowerCase().includes(termo) ||
      a.emailComprador?.toLowerCase().includes(termo) ||
      a.plano?.toLowerCase().includes(termo) ||
      this.rotuloStatus(a.status).toLowerCase().includes(termo)
    );
  });

  inadimplentes = computed(() => this.assinaturas().filter(a => a.status === 'INADIMPLENTE').length);
  encerradas = computed(() => this.assinaturas().filter(a => a.status === 'CANCELADA' || a.status === 'REEMBOLSADA').length);

  ngOnInit() {
    this.buscar();
  }

  buscar() {
    this.carregando.set(true);
    this.erro.set('');

    this.http.get<any>(this.API).subscribe({
      next: (res) => {
        // O endpoint devolve o envelope Response<T>: o resultado vem em value.
        const dados: RespostaAssinaturas = res?.value ?? res;
        this.assinaturas.set(dados?.assinaturas ?? []);
        this.totalAtivas.set(dados?.totalAtivas ?? 0);
        this.receita.set(dados?.receitaMensalEstimada ?? 0);
        this.carregando.set(false);
      },
      error: (err) => {
        this.erro.set(extrairMensagemErro(err, 'Não foi possível carregar as assinaturas.'));
        this.carregando.set(false);
      }
    });
  }

  // Status vem em maiúsculo do banco; a tela fala português e diz o que significa.
  rotuloStatus(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'ATIVA': return 'Ativa';
      case 'INADIMPLENTE': return 'Pagamento pendente';
      case 'CANCELADA': return 'Cancelada';
      case 'REEMBOLSADA': return 'Reembolsada';
      default: return status;
    }
  }

  ajudaStatus(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'ATIVA': return 'Conta liberada, cliente usando normalmente.';
      case 'INADIMPLENTE': return 'A cobrança falhou. A Cakto tenta de novo; se não entrar, a conta é suspensa.';
      case 'CANCELADA': return 'Assinatura encerrada. O cliente ainda entra e vê os dados, mas não envia mensagem.';
      case 'REEMBOLSADA': return 'Valor devolvido ao cliente e conta suspensa.';
      default: return '';
    }
  }

  classeStatus(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'ATIVA': return 'badge-green';
      case 'INADIMPLENTE': return 'badge-warn';
      default: return 'badge-danger';
    }
  }

  rotuloPlano(plano: string): string {
    switch ((plano || '').toUpperCase()) {
      case 'STARTER': return 'Starter';
      case 'PRO': return 'Pro';
      case 'ENTERPRISE': return 'Enterprise';
      default: return plano;
    }
  }
}
