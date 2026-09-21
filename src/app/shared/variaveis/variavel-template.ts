// Regras compartilhadas de "de onde sai o valor de cada variável {{n}} do template", usadas pelas
// telas de Disparos e Agendamentos. Espelham o ResolvedorDeVariaveis do backend, que é quem
// resolve de verdade no envio -- aqui serve para a prévia e para a validação antes de enviar.

export type CampoContato =
  | 'nome' | 'nomeCliente' | 'telefone' | 'valorFatura'
  | 'diaVencimento' | 'dataVencimento' | 'taxaJuros' | 'taxaJurosMensal';

export type OrigemVariavel = 'fixo' | 'parametro' | CampoContato;

export interface VariavelTemplate {
  origem: OrigemVariavel;
  valorFixo: string;
  // Só quando origem === 'parametro'.
  parametroId?: string | null;
}

export type TipoParametro = 'FIXO' | 'CAMPO_CONTATO';

// Parametro cadastrado por empresa (tela Parâmetros): FIXO guarda o texto em "valor";
// CAMPO_CONTATO guarda a chave de um CampoContato, resolvida por destinatário.
export interface ParametroEmpresa {
  id: string;
  empresaId: string;
  nome: string;
  descricao?: string | null;
  tipo: TipoParametro;
  valor: string;
}

// Os dados do contato que as variáveis podem usar (subconjunto do que /contato devolve).
export interface ContatoParaVariavel {
  nomeContato?: string | null;
  nomeCliente?: string | null;
  telefone: string;
  valorFatura?: number | null;
  diaVencimento?: number | null;
  taxaJuros?: number | null;
  taxaJurosMensal?: number | null;
}

export interface CampoContatoInfo {
  chave: CampoContato;
  rotulo: string;
}

export const CAMPOS_DO_CONTATO: CampoContatoInfo[] = [
  { chave: 'nome', rotulo: 'Nome do contato' },
  { chave: 'nomeCliente', rotulo: 'Nome do cliente (titular da fatura)' },
  { chave: 'telefone', rotulo: 'Telefone do contato' },
  { chave: 'valorFatura', rotulo: 'Valor da fatura' },
  { chave: 'diaVencimento', rotulo: 'Dia de vencimento' },
  { chave: 'dataVencimento', rotulo: 'Data de vencimento (dia do contato no mês atual)' },
  { chave: 'taxaJuros', rotulo: 'Taxa de juros' },
  { chave: 'taxaJurosMensal', rotulo: 'Taxa de juros mensal' },
];

export function rotuloDoCampo(chave: string): string {
  return CAMPOS_DO_CONTATO.find(c => c.chave === chave)?.rotulo ?? chave;
}

const FORMATO_BR = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

// Data de vencimento = dia do contato aplicado ao mês/ano de "hoje", com o dia clampado pro
// último dia do mês (dia 31 em abril vira 30). Mesmo critério do backend.
export function dataDeVencimento(dia: number | null | undefined, hoje: Date = new Date()): string {
  if (dia == null) return '';
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const d = Math.min(dia, ultimoDia);
  return `${String(d).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
}

function valorDoCampo(campo: string, contato: ContatoParaVariavel | null, hoje: Date): string {
  // Sem contato (prévia sem seleção): exemplo visível em vez de vazio.
  if (!contato) {
    switch (campo) {
      case 'nome': return 'Maria';
      case 'nomeCliente': return 'Maria Souza';
      case 'telefone': return '5511999990000';
      case 'valorFatura': return (405).toLocaleString('pt-BR', FORMATO_BR);
      case 'diaVencimento': return '20';
      case 'dataVencimento': return dataDeVencimento(20, hoje);
      case 'taxaJuros':
      case 'taxaJurosMensal': return (2).toLocaleString('pt-BR', FORMATO_BR);
      default: return '';
    }
  }

  switch (campo) {
    case 'nome': return contato.nomeContato || '';
    case 'nomeCliente': return contato.nomeCliente || '';
    case 'telefone': return contato.telefone || '';
    case 'valorFatura': return contato.valorFatura != null ? contato.valorFatura.toLocaleString('pt-BR', FORMATO_BR) : '';
    case 'diaVencimento': return contato.diaVencimento != null ? String(contato.diaVencimento) : '';
    case 'dataVencimento': return dataDeVencimento(contato.diaVencimento, hoje);
    case 'taxaJuros': return contato.taxaJuros != null ? contato.taxaJuros.toLocaleString('pt-BR', FORMATO_BR) : '';
    case 'taxaJurosMensal': return contato.taxaJurosMensal != null ? contato.taxaJurosMensal.toLocaleString('pt-BR', FORMATO_BR) : '';
    default: return '';
  }
}

function parametroDaVariavel(v: VariavelTemplate, parametros: ParametroEmpresa[]): ParametroEmpresa | undefined {
  return v.origem === 'parametro' ? parametros.find(p => p.id === v.parametroId) : undefined;
}

// O valor muda de contato pra contato? Só texto fixo (direto ou por parâmetro FIXO) vale igual pra todos.
export function dependeDoContato(v: VariavelTemplate, parametros: ParametroEmpresa[]): boolean {
  if (v.origem === 'fixo') return false;
  if (v.origem === 'parametro') return parametroDaVariavel(v, parametros)?.tipo === 'CAMPO_CONTATO';
  return true;
}

export function valorDaVariavel(
  v: VariavelTemplate, contato: ContatoParaVariavel | null,
  parametros: ParametroEmpresa[], hoje: Date = new Date()
): string {
  if (v.origem === 'fixo') return v.valorFixo;

  if (v.origem === 'parametro') {
    const p = parametroDaVariavel(v, parametros);
    if (!p) return '';
    return p.tipo === 'CAMPO_CONTATO' ? valorDoCampo(p.valor, contato, hoje) : p.valor;
  }

  return valorDoCampo(v.origem, contato, hoje);
}

// Variável configurada de forma incompleta (texto fixo em branco, parâmetro não escolhido ou
// que foi excluído) -- impede salvar/enviar.
export function variavelIncompleta(v: VariavelTemplate, parametros: ParametroEmpresa[]): boolean {
  if (v.origem === 'fixo') return !v.valorFixo.trim();
  if (v.origem === 'parametro') return !parametroDaVariavel(v, parametros);
  return false;
}

// Valor do <select> de origem: 'fixo', um campo do contato ou 'parametro:<id>'.
export function selecaoDaVariavel(v: VariavelTemplate): string {
  return v.origem === 'parametro' ? `parametro:${v.parametroId ?? ''}` : v.origem;
}

export function variavelDaSelecao(selecao: string): Partial<VariavelTemplate> {
  if (selecao.startsWith('parametro:')) {
    return { origem: 'parametro', parametroId: selecao.slice('parametro:'.length) };
  }
  return { origem: selecao as OrigemVariavel, parametroId: null };
}

export function dicaDaVariavel(v: VariavelTemplate, parametros: ParametroEmpresa[]): string {
  if (v.origem === 'fixo') return '';

  if (v.origem === 'parametro') {
    const p = parametroDaVariavel(v, parametros);
    if (!p) return 'Escolha um dos parâmetros cadastrados.';
    return p.tipo === 'CAMPO_CONTATO'
      ? `Cada contato recebe o campo "${rotuloDoCampo(p.valor)}" dele, resolvido no momento do envio.`
      : `Todos recebem o texto fixo do parâmetro: "${p.valor}".`;
  }

  return `Cada contato recebe o campo "${rotuloDoCampo(v.origem)}" dele, resolvido no momento do envio.`;
}
