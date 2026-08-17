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

// Só templates recusados podem ser editados: a Meta não aceita alteração em template
// aprovado nem em template ainda em análise (nesse caso ela devolvia erro e a tela mostrava
// um "não foi possível concluir a operação" sem explicação).
export const STATUS_EDITAVEIS = ['REJECTED', 'REJECTED_META'];

// Texto do botão desabilitado: precisa dizer o motivo, não só que não dá.
export function motivoNaoEditavel(status?: string): string {
  const s = (status || 'PENDING').toUpperCase();
  if (s === 'PENDING') return 'Em análise na Meta: dá para editar só depois do resultado. Se for recusado, você edita e reenvia.';
  return 'Modelo já aprovado: a Meta não permite alterar. Crie um novo modelo.';
}

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

// Idiomas mais usados por quem dispara mensagem no Brasil — exibidos no topo do seletor
// pra não precisar rolar a lista inteira toda vez que for criar um template.
export const CODIGOS_IDIOMAS_MAIS_USADOS = ['pt_BR', 'en_US', 'es_ES', 'es_MX'];

// --- Camada "para leigos": objetivo em vez de categoria da Meta ---
// Categoria errada é a maior causa de rejeição de template, e "UTILITY/MARKETING" não diz
// nada pra quem nunca leu a documentação da Meta. Perguntar o objetivo em português resolve
// a categoria por dedução, sem o usuário precisar saber que ela existe.
export type ObjetivoTemplate = 'AVISO' | 'PROMOCAO' | 'CODIGO';

export interface ObjetivoInfo {
  id: ObjetivoTemplate;
  emoji: string;
  titulo: string;
  descricao: string;
  exemplo: string;
  categoria: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
}

export const OBJETIVOS_TEMPLATE: ObjetivoInfo[] = [
  {
    id: 'AVISO',
    emoji: '📦',
    titulo: 'Avisar o cliente sobre algo',
    descricao: 'Pedido, entrega, agendamento, cobrança, atendimento.',
    exemplo: 'Ex: "Seu pedido saiu para entrega"',
    categoria: 'UTILITY',
  },
  {
    id: 'PROMOCAO',
    emoji: '📣',
    titulo: 'Divulgar uma oferta',
    descricao: 'Promoção, cupom, novidade, convite — qualquer coisa que venda.',
    exemplo: 'Ex: "20% de desconto só hoje"',
    categoria: 'MARKETING',
  },
  {
    id: 'CODIGO',
    emoji: '🔐',
    titulo: 'Enviar um código de acesso',
    descricao: 'Código de verificação ou confirmação de login (OTP).',
    exemplo: 'Ex: "Seu código é 123456"',
    categoria: 'AUTHENTICATION',
  },
];

export interface ModeloPronto {
  id: string;
  objetivo: ObjetivoTemplate;
  titulo: string;
  nomeSugerido: string;
  conteudo: string;
  exemplos: string[];
  footer?: string;
  botoes?: TemplateBotaoForm[];
}

// Modelos prontos, escritos no tom que a Meta costuma aprovar (mensagem clara, sem promessa
// enganosa e sem pedir dado sensível). Servem de ponto de partida: o usuário edita o texto
// depois, mas já começa com a estrutura de variáveis e botões montada.
export const MODELOS_PRONTOS: ModeloPronto[] = [
  {
    id: 'pedido_confirmado',
    objetivo: 'AVISO',
    titulo: 'Pedido confirmado',
    nomeSugerido: 'Pedido confirmado',
    conteudo: 'Olá {{1}}! Recebemos seu pedido {{2}} e já começamos a preparar tudo. Avisamos assim que ele sair para entrega.',
    exemplos: ['Maria', '#1234'],
    footer: 'Mensagem automática',
  },
  {
    id: 'pedido_a_caminho',
    objetivo: 'AVISO',
    titulo: 'Pedido a caminho',
    nomeSugerido: 'Pedido a caminho',
    conteudo: 'Boa notícia, {{1}}! Seu pedido {{2}} saiu para entrega e chega até {{3}}.',
    exemplos: ['Maria', '#1234', 'hoje às 18h'],
    botoes: [{ tipo: 'QUICK_REPLY', texto: 'Acompanhar entrega' }],
  },
  {
    id: 'lembrete_agendamento',
    objetivo: 'AVISO',
    titulo: 'Lembrete de agendamento',
    nomeSugerido: 'Lembrete de agendamento',
    conteudo: 'Olá {{1}}, passando para lembrar do seu horário de {{2}} no dia {{3}}. Podemos confirmar?',
    exemplos: ['Maria', 'corte de cabelo', '12/09 às 15h'],
    botoes: [
      { tipo: 'QUICK_REPLY', texto: 'Confirmar' },
      { tipo: 'QUICK_REPLY', texto: 'Remarcar' },
    ],
  },
  {
    id: 'aviso_vencimento',
    objetivo: 'AVISO',
    titulo: 'Aviso de vencimento',
    nomeSugerido: 'Aviso de vencimento',
    conteudo: 'Olá {{1}}, sua fatura de {{2}} vence em {{3}}. Se precisar da segunda via, é só responder esta mensagem.',
    exemplos: ['Maria', 'R$ 149,90', '20/09'],
    footer: 'Mensagem automática',
  },
  {
    id: 'oferta_com_cupom',
    objetivo: 'PROMOCAO',
    titulo: 'Oferta com cupom',
    nomeSugerido: 'Oferta com cupom',
    conteudo: '{{1}}, separamos uma oferta pra você: {{2}} de desconto até {{3}}. É só usar o cupom abaixo na finalização.',
    exemplos: ['Maria', '20%', 'domingo'],
    botoes: [{ tipo: 'COPY_CODE', texto: 'Copiar código', codigoExemplo: 'PROMO20' }],
  },
  {
    id: 'novidade_na_loja',
    objetivo: 'PROMOCAO',
    titulo: 'Novidade na loja',
    nomeSugerido: 'Novidade na loja',
    conteudo: 'Oi {{1}}! Chegou novidade aqui na {{2}}: {{3}}. Quer dar uma olhada?',
    exemplos: ['Maria', 'Loja do João', 'a nova coleção de verão'],
    botoes: [{ tipo: 'URL', texto: 'Ver novidades', url: 'https://' }],
  },
  {
    id: 'carrinho_abandonado',
    objetivo: 'PROMOCAO',
    titulo: 'Carrinho abandonado',
    nomeSugerido: 'Carrinho abandonado',
    conteudo: '{{1}}, você deixou {{2}} no carrinho. Ainda dá tempo de garantir o seu!',
    exemplos: ['Maria', 'a camiseta preta'],
    botoes: [{ tipo: 'URL', texto: 'Finalizar compra', url: 'https://' }],
  },
  {
    id: 'codigo_de_verificacao',
    objetivo: 'CODIGO',
    titulo: 'Código de verificação',
    nomeSugerido: 'Codigo de verificacao',
    conteudo: 'Seu código de verificação é {{1}}. Ele expira em {{2}} minutos. Nunca compartilhe esse código com ninguém.',
    exemplos: ['123456', '10'],
    botoes: [{ tipo: 'COPY_CODE', texto: 'Copiar código', codigoExemplo: '123456' }],
  },
];

// O nome que a Meta aceita é estrito (minúsculo, sem espaço nem acento). Em vez de exigir isso
// do usuário, ele digita um nome normal e a tela deriva o técnico — mostrando qual ficou.
export function gerarNomeTecnico(nomeAmigavel: string): string {
  return nomeAmigavel
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export interface StatusExplicado {
  rotulo: string;
  ajuda: string;
  classe: 'badge-green' | 'badge-warn' | 'badge-danger';
}

// "APPROVED"/"PENDING"/"REJECTED" vêm da Meta em inglês e não dizem o que fazer a seguir.
export function explicarStatus(status?: string): StatusExplicado {
  const s = (status || 'PENDING').toUpperCase();
  if (s === 'APPROVED' || s === 'APPROVED_META') {
    return { rotulo: 'Aprovado', ajuda: 'Pronto para usar nos disparos e nos flows.', classe: 'badge-green' };
  }
  if (s === 'PENDING') {
    return { rotulo: 'Em análise', ajuda: 'A Meta está revisando. Costuma levar de alguns minutos a 24h.', classe: 'badge-warn' };
  }
  return { rotulo: 'Rejeitado', ajuda: 'A Meta recusou. Edite o texto (ou troque o objetivo) e envie de novo.', classe: 'badge-danger' };
}

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
