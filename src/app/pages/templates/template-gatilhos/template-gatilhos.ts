import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { extrairMensagemErro } from '../../../core/utils/erro-api.util';
import { TemplateService } from '../template.service';
import { GATILHOS_INFO, Template, TemplateGatilho, TipoGatilho } from '../template.models';
import {
  CAMPOS_DO_CONTATO, ParametroEmpresa, VariavelTemplate, dicaDaVariavel, selecaoDaVariavel,
  variavelDaSelecao, variavelIncompleta
} from '../../../shared/variaveis/variavel-template';

interface EstadoGatilho {
  tipo: TipoGatilho;
  ligado: boolean;
  diasAtraso: number | null;
  variaveis: VariavelTemplate[];
}

// Seção "Momentos de disparo" de um template: liga/desliga cada gatilho e diz de onde sai cada
// variável do corpo, já que no disparo automático ninguém está na tela para preencher.
@Component({
  selector: 'app-template-gatilhos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-gatilhos.html',
  styleUrls: ['./template-gatilhos.css'],
})
export class TemplateGatilhosComponent implements OnInit {
  @Input({ required: true }) template!: Template;
  @Input() gatilhos: TemplateGatilho[] = [];
  @Input() parametros: ParametroEmpresa[] = [];
  @Output() salvo = new EventEmitter<TemplateGatilho[]>();

  private templateService = inject(TemplateService);

  readonly info = GATILHOS_INFO;
  readonly camposDoContato = CAMPOS_DO_CONTATO;

  estados = signal<EstadoGatilho[]>([]);
  salvando = signal(false);
  mensagem = signal('');
  erro = signal(false);

  ngOnInit() {
    const qtd = (this.template.conteudo.match(/\{\{\d+\}\}/g) || []).length;
    this.estados.set(GATILHOS_INFO.map(i => {
      const existente = this.gatilhos.find(g => g.tipo === i.tipo);
      return {
        tipo: i.tipo,
        ligado: !!existente?.ativo,
        diasAtraso: existente?.diasAtraso ?? (i.tipo === 'ATRASO_PAGAMENTO' ? 1 : null),
        // Gatilho salvo antes de o texto do modelo mudar pode ter outra quantidade de campos:
        // remonta em vez de mandar uma lista que o backend recusaria.
        variaveis: existente && existente.variaveis.length === qtd
          ? existente.variaveis.map(v => ({ ...v, valorFixo: v.valorFixo ?? '' }))
          // {{1}} quase sempre é o nome do cliente -- mesmo padrão do Disparador e Agendamentos.
          : Array.from({ length: qtd }, (_, idx) => ({ origem: idx === 0 ? 'nome' : 'fixo', valorFixo: '' } as VariavelTemplate)),
      };
    }));
  }

  aprovado(): boolean {
    return (this.template.status || '').toUpperCase().startsWith('APPROVED');
  }

  tituloDe(tipo: TipoGatilho) {
    return this.info.find(i => i.tipo === tipo)!;
  }

  private atualizar(tipo: TipoGatilho, mudanca: Partial<EstadoGatilho>) {
    this.estados.update(lista => lista.map(e => e.tipo === tipo ? { ...e, ...mudanca } : e));
    this.mensagem.set('');
  }

  alternar(tipo: TipoGatilho, ligado: boolean) {
    this.atualizar(tipo, { ligado });
  }

  mudarDias(tipo: TipoGatilho, valor: any) {
    const n = valor === '' || valor === null || valor === undefined ? null : Number(valor);
    this.atualizar(tipo, { diasAtraso: n !== null && isNaN(n) ? null : n });
  }

  selecao(v: VariavelTemplate) {
    return selecaoDaVariavel(v);
  }

  dica(v: VariavelTemplate) {
    return dicaDaVariavel(v, this.parametros);
  }

  mudarVariavel(tipo: TipoGatilho, indice: number, mudanca: Partial<VariavelTemplate>) {
    const estado = this.estados().find(e => e.tipo === tipo)!;
    const variaveis = estado.variaveis.map((v, i) => i === indice ? { ...v, ...mudanca } : v);
    this.atualizar(tipo, { variaveis });
  }

  trocarOrigem(tipo: TipoGatilho, indice: number, selecao: string) {
    this.mudarVariavel(tipo, indice, variavelDaSelecao(selecao));
  }

  salvar() {
    const ligados = this.estados().filter(e => e.ligado);

    const atraso = ligados.find(e => e.tipo === 'ATRASO_PAGAMENTO');
    if (atraso && (atraso.diasAtraso === null || atraso.diasAtraso < 0 || atraso.diasAtraso > 365)) {
      this.falhar('Informe com quantos dias de atraso (0 a 365) a mensagem deve sair.');
      return;
    }

    if (ligados.some(e => e.variaveis.some(v => variavelIncompleta(v, this.parametros)))) {
      this.falhar('Defina de onde sai cada campo da mensagem (texto em branco ou parâmetro não escolhido).');
      return;
    }

    const gatilhos: TemplateGatilho[] = ligados.map(e => ({
      tipo: e.tipo,
      diasAtraso: e.tipo === 'ATRASO_PAGAMENTO' ? e.diasAtraso : null,
      ativo: true,
      variaveis: e.variaveis,
    }));

    this.salvando.set(true);
    this.templateService.salvarGatilhos(this.template.id, gatilhos).subscribe({
      next: () => {
        this.salvando.set(false);
        this.erro.set(false);
        this.mensagem.set(gatilhos.length
          ? '✅ Momentos de disparo salvos.'
          : '✅ Nenhum momento de disparo ligado: o modelo só sai quando alguém enviar.');
        this.salvo.emit(gatilhos.map(g => ({ ...g, templateId: this.template.id })));
      },
      error: (err) => {
        this.salvando.set(false);
        this.falhar(extrairMensagemErro(err, 'Não foi possível salvar os momentos de disparo.'));
      }
    });
  }

  private falhar(msg: string) {
    this.erro.set(true);
    this.mensagem.set(msg);
  }
}
