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
        id: 'flows', label: 'Flows', route: '/flows',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path d="M12 7v3"/><path d="M7 13H5a2 2 0 00-2 2v1"/><path d="M17 13h2a2 2 0 012 2v1"/><circle cx="3" cy="19" r="2"/><circle cx="21" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><path d="M12 16v1"/></svg>`,
      },
      {
        id: 'relatorio', label: 'Relatório de Mensagens', route: '/relatorio',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>`,
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
        id: 'templates', label: 'Templates', route: '/templates',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      }
    ],
  },
];

/**
 * Retorna o menu correto baseando-se diretamente na role fornecida pelo AuthService
 */
export function getMenuByRole(role: string | undefined): MenuSection[] {
  // Se for admin, retorna tudo sem filtros
  if (role === 'admin') {
    return MENU_RAW;
  }

  // IDs das telas permitidas para operador comum
  const telasPermitidas = ['disparador', 'contatos', 'numeros', 'templates'];

  return MENU_RAW.map(section => ({
    ...section,
    items: section.items.filter(item => telasPermitidas.includes(item.id))
  })).filter(section => section.items.length > 0);
}

// Mantemos o export do MENU original como fallback para evitar quebras em outros locais
export const MENU: MenuSection[] = MENU_RAW;

export const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  chats: 'Chats Ativos',
  disparador: 'Disparos em Massa',
  flows: 'Flows de Conversa',
  empresas: 'Empresas',
  contatos: 'Contatos',
  numeros: 'Números',
  templates: 'Templates',
  usuarios: 'Usuários',
  relatorio: 'Relatório de Mensagens',
};
