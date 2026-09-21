export interface MenuItem {
  id: string;
  label: string;
  route: string;
  icon: string;          // SVG inline
  badge?: string | number;
  badgeType?: 'default' | 'warn' | 'danger';
}

export interface MenuSection {
  label: string;
  items: MenuItem[];
}

// 1. Estrutura com todas as telas do sistema
const MENU_RAW: MenuSection[] = [
  {
    label: 'Painel',
    items: [
      {
        id: 'dashboard', label: 'Dashboard', route: '/dashboard',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
      },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      {
        id: 'chats', label: 'Chats Ativos', route: '/chats',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
      },
      {
        id: 'disparador', label: 'Disparos', route: '/disparador',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>`,
      },
      {
        id: 'agendamentos', label: 'Agendamentos', route: '/agendamentos',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      },
      {
        id: 'flows', label: 'Flows', route: '/flows',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path d="M12 7v3"/><path d="M7 13H5a2 2 0 00-2 2v1"/><path d="M17 13h2a2 2 0 012 2v1"/><circle cx="3" cy="19" r="2"/><circle cx="21" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><path d="M12 16v1"/></svg>`,
      },
      {
        id: 'relatorio', label: 'Relatório de Mensagens', route: '/relatorio',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>`,
      },
      {
        id: 'metricas', label: 'Financeiro & Engajamento', route: '/metricas',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
      },
    ],
  },
  {
    label: 'Gestão',
    items: [
      {
        id: 'empresas', label: 'Empresas', route: '/empresas',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>`,
      },
      {
        id: 'contatos', label: 'Contatos', route: '/contatos',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
      },
      {
        id: 'numeros', label: 'Números', route: '/numeros',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
      },
      {
        id: 'usuarios', label: 'Usuários', route: '/usuarios',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      },
      {
        id: 'perfis', label: 'Perfis de Acesso', route: '/perfis',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
      },
      {
        id: 'parametros', label: 'Parâmetros', route: '/parametros',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
      },
      {
        id: 'cobrancas', label: 'Cobranças', route: '/cobrancas',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
      },
      {
        id: 'templates', label: 'Templates', route: '/templates',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      }
    ],
  },
];

// Catalogo de telas pra tela de gestao de Perfis (checkboxes) -- mesmos "id" usados no
// MENU_RAW acima e gravados em PerfilTela.TelaChave no backend. "perfis" fica de fora de
// proposito: essa tela e exclusiva da conta de plataforma (ver getMenuVisivel /
// platformAdminGuard), nao faz sentido um Perfil de empresa cliente liberar acesso a ela.
export const TELAS_DISPONIVEIS: { id: string; label: string }[] =
  MENU_RAW.flatMap(secao => secao.items.map(item => ({ id: item.id, label: item.label })))
    .filter(tela => tela.id !== 'perfis');

/**
 * Resolve o menu que o usuario logado enxerga.
 *
 * - Conta de plataforma (Contact Solution): sempre tudo, sem filtro -- e quem cadastra
 *   empresa nova e a unica que gerencia Perfis de Acesso.
 * - Usuario com Perfil atribuido (estrutura de acesso modular): so as telas que o Perfil
 *   libera, ponto -- nao herda mais o allowlist fixo do "operador".
 * - Usuario sem Perfil (legado, antes desta feature existir): cai no comportamento antigo
 *   (admin ve tudo, operador cai no allowlist fixo), pra nao quebrar quem ja estava configurado.
 *
 * Em nenhum caminho que nao seja conta de plataforma a tela "perfis" aparece -- mesmo o
 * legado "admin ve tudo" e filtrado pra excluir ela.
 */
export function getMenuVisivel(
  role: string | undefined,
  ehAdminDaPlataforma: boolean,
  telasPermitidas: string[] | null | undefined
): MenuSection[] {
  if (ehAdminDaPlataforma) {
    return MENU_RAW;
  }

  // null/undefined = sem Perfil atribuido (legado). Array (mesmo vazio) = Perfil atribuido,
  // a lista dele manda -- inclusive quando vazia (perfil sem nenhuma tela marcada).
  const telas = telasPermitidas == null
    ? (role === 'admin'
        ? MENU_RAW.flatMap(secao => secao.items.map(item => item.id)) // legado: admin ve tudo, como sempre foi.
        : ['disparador', 'agendamentos', 'contatos', 'numeros', 'templates'])
    : telasPermitidas;

  const telasSemPerfis = telas.filter(t => t !== 'perfis');

  return MENU_RAW.map(section => ({
    ...section,
    items: section.items.filter(item => telasSemPerfis.includes(item.id))
  })).filter(section => section.items.length > 0);
}

// Mantido por compatibilidade com qualquer chamador antigo -- equivalente ao caminho legado.
export function getMenuByRole(role: string | undefined): MenuSection[] {
  return getMenuVisivel(role, false, null);
}

// Mantemos o export do MENU original como fallback para evitar quebras em outros locais
export const MENU: MenuSection[] = MENU_RAW;

export const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  chats: 'Chats Ativos',
  disparador: 'Disparos em Massa',
  agendamentos: 'Agendamentos',
  flows: 'Flows de Conversa',
  empresas: 'Empresas',
  contatos: 'Contatos',
  numeros: 'Números',
  templates: 'Templates',
  usuarios: 'Usuários',
  perfis: 'Perfis de Acesso',
  relatorio: 'Relatório de Mensagens',
  metricas: 'Financeiro & Engajamento',
  parametros: 'Parâmetros',
  cobrancas: 'Cobranças',
};
