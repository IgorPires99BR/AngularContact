export type TipoRecorrencia = 'DIARIA' | 'SEMANAL' | 'MENSAL';

// De onde sai o valor de cada variável do corpo do template. "fixo" = o mesmo texto para todo
// mundo; "nome"/"telefone" = o dado de cada contato, resolvido a cada disparo recorrente.
export type OrigemVariavelAgendamento = 'fixo' | 'nome' | 'telefone';

export interface AgendamentoVariavel {
  origem: OrigemVariavelAgendamento;
  valorFixo: string;
}

export interface Agendamento {
  id: string;
  nome: string;
  templateId: string;
  nomeTemplate?: string;
  tipoRecorrencia: TipoRecorrencia;
  dataInicio: string;
  dataFim?: string | null;
  dataReferencia: string;
  proximaExecucao: string;
  ativo: boolean;
  totalContatos: number;
  // 0=Domingo...6=Sábado (igual DayOfWeek do .NET). Só relevante quando tipoRecorrencia === 'SEMANAL'.
  diasSemana?: number[];
  // 1-31. Só relevante quando tipoRecorrencia === 'MENSAL'.
  diaDoMes?: number | null;
}

export interface AgendamentoDetalhe {
  id: string;
  nome: string;
  templateId: string;
  tipoRecorrencia: TipoRecorrencia;
  dataInicio: string;
  dataFim?: string | null;
  dataReferencia: string;
  proximaExecucao: string;
  ativo: boolean;
  contatoIds: string[];
  variaveis: AgendamentoVariavel[];
  diasSemana?: number[];
  diaDoMes?: number | null;
}

export interface AgendamentoExecucao {
  id: string;
  dataExecucao: string;
  totalContatos: number;
  sucessos: number;
  falhas: number;
  status: string;
}

export const ROTULO_RECORRENCIA: Record<TipoRecorrencia, string> = {
  DIARIA: 'Diária',
  SEMANAL: 'Semanal',
  MENSAL: 'Mensal',
};

// Domingo primeiro pra bater com DayOfWeek do .NET (0=Domingo), que é quem grava/lê o valor no banco.
export interface DiaDaSemanaOpcao {
  valor: number;
  curto: string;
  rotulo: string;
}

export const DIAS_DA_SEMANA: DiaDaSemanaOpcao[] = [
  { valor: 0, curto: 'D', rotulo: 'Domingo' },
  { valor: 1, curto: 'S', rotulo: 'Segunda' },
  { valor: 2, curto: 'T', rotulo: 'Terça' },
  { valor: 3, curto: 'Q', rotulo: 'Quarta' },
  { valor: 4, curto: 'Q', rotulo: 'Quinta' },
  { valor: 5, curto: 'S', rotulo: 'Sexta' },
  { valor: 6, curto: 'S', rotulo: 'Sábado' },
];

// "1,3,5" -> "Seg, Qua, Sex", pra mostrar na grid sem repetir a lista de opções em cada lugar.
export function resumoDiasSemana(dias?: number[] | null): string {
  if (!dias || dias.length === 0) return '';
  const abreviacoes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return [...dias].sort((a, b) => a - b).map(d => abreviacoes[d] ?? '?').join(', ');
}

// Descrição legível da recorrência pra grid de agendamentos cadastrados -- "Semanal" sozinho não
// diz se é todo dia ou só seg/qua/sex, e "Mensal" não diz em que dia do mês.
export function descricaoRecorrencia(a: Pick<Agendamento, 'tipoRecorrencia' | 'diasSemana' | 'diaDoMes'>): string {
  if (a.tipoRecorrencia === 'SEMANAL' && a.diasSemana && a.diasSemana.length > 0) {
    return `Semanal (${resumoDiasSemana(a.diasSemana)})`;
  }
  if (a.tipoRecorrencia === 'MENSAL' && a.diaDoMes) {
    return `Mensal (dia ${a.diaDoMes})`;
  }
  return ROTULO_RECORRENCIA[a.tipoRecorrencia];
}
