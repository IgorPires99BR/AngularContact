export type TipoRecorrencia = 'DIARIA' | 'SEMANAL' | 'MENSAL';

export interface Agendamento {
  id: string;
  nome: string;
  templateId: string;
  nomeTemplate?: string;
  tipoRecorrencia: TipoRecorrencia;
  dataInicio: string;
  dataFim?: string | null;
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
  proximaExecucao: string;
  ativo: boolean;
  contatoIds: string[];
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
