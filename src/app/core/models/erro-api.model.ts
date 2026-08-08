// Formato unico que a API do backend devolve em toda resposta de erro (400/403/404/500):
// um array de { mensagem, tipo }. "Negocio" e sempre seguro mostrar direto ao usuario
// (validacao, regra, "nao encontrado"); "Servico" e falha tecnica (banco, integracao com
// a Meta) com mensagem ja generica -- a tela pode escolher tratar diferente (ex: sugerir
// "tente novamente" em vez do texto cru).
export type TipoErroApi = 'Negocio' | 'Servico';

export interface ErroApi {
  mensagem: string;
  tipo: TipoErroApi;
}
