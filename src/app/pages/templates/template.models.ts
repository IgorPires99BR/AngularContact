// Modelos compartilhados de Template (WhatsApp/Meta), usados pela tela de Templates, pelo
// Disparador e pelo Mapa Mental — para não ter 3 definições divergentes do mesmo formato.

// --- Formato armazenado em Template.componentesJson (serializado em PascalCase pelo backend
// via Newtonsoft, independente da política de casing usada nos demais campos da resposta) ---

/** 0 = Header, 1 = Body, 2 = Footer, 3 = Buttons */
export type TipoComponenteTemplate = 0 | 1 | 2 | 3;
/** 0 = QuickReply, 1 = Url, 2 = PhoneNumber, 3 = CopyCode */
export type TipoBotaoTemplateIndice = 0 | 1 | 2 | 3;
/** 0 = None, 1 = Text, 2 = Image, 3 = Video, 4 = Document */
export type TipoMidiaTemplateIndice = 0 | 1 | 2 | 3 | 4;

export interface TemplateBotao {
  Tipo: TipoBotaoTemplateIndice;
  Texto: string;
  Url?: string;
  NumeroTelefone?: string;
  CodigoExemplo?: string;
}

export interface TemplateComponente {
  Tipo: TipoComponenteTemplate;
  FormatMidia: TipoMidiaTemplateIndice;
  Texto?: string;
  Botoes?: TemplateBotao[];
}

// --- Registro de Template como devolvido pela API (campos em camelCase) ---
export interface Template {
  id: string;
  empresaId: string;
  nomeTemplate: string;
  conteudo: string;
  categoria: string;
  idioma: string;
  status: string; // APPROVED, PENDING, REJECTED, REJECTED_META...
  metaTemplateId?: string;
  componentesJson?: string;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

// --- Estado de botão usado no formulário de criação/edição (tipo como string, formato que a
// API de escrita — CriaTemplateCommand/AtualizaTemplateCommand — espera) ---
export type TipoBotaoForm = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';

export interface TemplateBotaoForm {
  tipo: TipoBotaoForm;
  texto: string;
  url?: string;
  numeroTelefone?: string;
  codigoExemplo?: string;
}

// Mapeia o índice numérico persistido (Tipo) de volta pro tipo de botão legível em string
export const TIPO_BOTAO_POR_INDICE: TipoBotaoForm[] = ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'];

export function rotuloTipoBotao(tipo: TipoBotaoForm): string {
  switch (tipo) {
    case 'QUICK_REPLY': return 'Resposta Rápida';
    case 'URL': return 'Link';
    case 'PHONE_NUMBER': return 'Telefone';
    case 'COPY_CODE': return 'Cupom';
    default: return tipo;
  }
}

// Só templates PENDING/REJECTED podem ser editados — a Meta não aceita editar um APPROVED
export const STATUS_EDITAVEIS = ['PENDING', 'REJECTED', 'REJECTED_META'];

export interface IdiomaMeta {
  codigo: string;
  rotulo: string;
}

// Lista curada dos idiomas mais comuns suportados pela Meta (a lista oficial completa passa de
// 70 códigos) — cobre os principais mercados de quem monta templates pra disparo em massa.
export const IDIOMAS_META: IdiomaMeta[] = [
  { codigo: 'pt_BR', rotulo: 'Português (Brasil)' },
  { codigo: 'pt_PT', rotulo: 'Português (Portugal)' },
  { codigo: 'en_US', rotulo: 'Inglês (EUA)' },
  { codigo: 'en_GB', rotulo: 'Inglês (Reino Unido)' },
  { codigo: 'es_ES', rotulo: 'Espanhol (Espanha)' },
  { codigo: 'es_MX', rotulo: 'Espanhol (México)' },
  { codigo: 'es_AR', rotulo: 'Espanhol (Argentina)' },
  { codigo: 'fr', rotulo: 'Francês' },
  { codigo: 'de', rotulo: 'Alemão' },
  { codigo: 'it', rotulo: 'Italiano' },
  { codigo: 'nl', rotulo: 'Holandês' },
  { codigo: 'pl', rotulo: 'Polonês' },
  { codigo: 'ro', rotulo: 'Romeno' },
  { codigo: 'sv', rotulo: 'Sueco' },
  { codigo: 'tr', rotulo: 'Turco' },
  { codigo: 'ru', rotulo: 'Russo' },
  { codigo: 'uk', rotulo: 'Ucraniano' },
  { codigo: 'ar', rotulo: 'Árabe' },
  { codigo: 'he', rotulo: 'Hebraico' },
  { codigo: 'hi', rotulo: 'Hindi' },
  { codigo: 'id', rotulo: 'Indonésio' },
  { codigo: 'ja', rotulo: 'Japonês' },
  { codigo: 'ko', rotulo: 'Coreano' },
  { codigo: 'zh_CN', rotulo: 'Chinês (Simplificado)' },
  { codigo: 'zh_TW', rotulo: 'Chinês (Tradicional)' },
  { codigo: 'th', rotulo: 'Tailandês' },
  { codigo: 'vi', rotulo: 'Vietnamita' },
];

export interface HeaderState {
  tipo: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  texto: string;
  exemploHandle: string;
  exemploNomeArquivo: string;
}

export function headerStateVazio(): HeaderState {
  return { tipo: 'NONE', texto: '', exemploHandle: '', exemploNomeArquivo: '' };
}

// Extrai header/footer/botões a partir do componentesJson salvo (usado tanto pra exibir na
// lista quanto pra popular o formulário em modo edição)
export function parseComponentes(componentesJson?: string): TemplateComponente[] {
  if (!componentesJson) return [];
  try {
    return JSON.parse(componentesJson) as TemplateComponente[];
  } catch {
    return [];
  }
}
