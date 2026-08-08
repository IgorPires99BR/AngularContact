import { HttpErrorResponse } from '@angular/common/http';
import { ErroApi, TipoErroApi } from '../models/erro-api.model';

const MENSAGEM_PADRAO = 'Não foi possível concluir a operação. Tente novamente.';

// Le o corpo de uma resposta de erro HTTP e devolve a lista de erros no formato novo
// ({ mensagem, tipo }). Aceita os formatos antigos que o backend ja usou (array de
// string solta, { erro }, { erros }, { message }) como fallback -- assim nenhuma tela
// quebra se algum endpoint ainda nao tiver migrado pro formato novo.
export function extrairErrosApi(erro: unknown): ErroApi[] {
  if (!(erro instanceof HttpErrorResponse)) return [];

  const corpo: any = erro.error;

  if (Array.isArray(corpo)) {
    return corpo.map((item) =>
      typeof item === 'string'
        ? { mensagem: item, tipo: 'Negocio' as TipoErroApi }
        : { mensagem: item?.mensagem ?? MENSAGEM_PADRAO, tipo: (item?.tipo as TipoErroApi) ?? 'Negocio' }
    );
  }

  if (corpo?.mensagem) {
    return [{ mensagem: corpo.mensagem, tipo: (corpo.tipo as TipoErroApi) ?? 'Negocio' }];
  }

  if (Array.isArray(corpo?.erros)) {
    return extrairErrosApi(new HttpErrorResponse({ error: corpo.erros, status: erro.status, url: erro.url ?? undefined }));
  }

  if (corpo?.erro) {
    return [{ mensagem: corpo.erro, tipo: 'Negocio' }];
  }

  if (corpo?.message) {
    return [{ mensagem: corpo.message, tipo: 'Negocio' }];
  }

  // ProblemDetails automatico do ASP.NET Core ({ errors: { campo: ["msg"] }, title: "..." }):
  // aparece quando o [ApiController] rejeita o multipart/model binding ANTES do nosso codigo
  // rodar (ex: campo obrigatorio faltando), formato diferente do erro customizado do projeto.
  if (corpo?.errors && typeof corpo.errors === 'object') {
    const mensagens = Object.values(corpo.errors as Record<string, string[]>).flat();
    if (mensagens.length > 0) {
      return mensagens.map((m) => ({ mensagem: m, tipo: 'Negocio' as TipoErroApi }));
    }
  }

  if (corpo?.title) {
    return [{ mensagem: corpo.title, tipo: 'Negocio' }];
  }

  return [];
}

// Junta as mensagens de erro numa unica string pronta pra exibir -- a maioria das telas
// hoje so tem espaco pra mostrar uma mensagem, nao uma lista.
export function extrairMensagemErro(erro: unknown, mensagemPadrao: string = MENSAGEM_PADRAO): string {
  const erros = extrairErrosApi(erro);
  if (erros.length === 0) return mensagemPadrao;
  return erros.map((e) => e.mensagem).join(' ');
}
