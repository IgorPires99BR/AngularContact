// Validações compartilhadas pelos formulários de cadastro (Contatos, Empresas,
// Usuários, Números, Templates), que usam ngModel simples em vez de Reactive Forms
// e por isso não disparam a validação nativa do HTML5 (não há <form>/submit).

export function isEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
