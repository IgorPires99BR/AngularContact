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
