import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent {
  kpisMain = [
    { icon: '📤', label: 'Msgs Enviadas Hoje', value: '1.847', delta: '▲ 18% vs ontem', deltaType: 'up' },
    { icon: '✅', label: 'Taxa de Entrega',    value: '98.4%', delta: '▲ 2.1%',         deltaType: 'up' },
    { icon: '🎯', label: 'Leads Capturados',   value: '342',   delta: '▲ 7 hoje',       deltaType: 'up' },
    { icon: '💬', label: 'Chats Ativos',       value: '12',    delta: 'Em andamento',   deltaType: 'n'  },
  ];

  kpisStatus = [
    { icon: '📱', label: 'Números Ativos',     value: '8',  delta: 'Operando normalmente',   deltaType: 'up',   tone: 'green'  },
    { icon: '⏳', label: 'Números Pendentes',  value: '2',  delta: 'Aguardando verificação', deltaType: 'n',    tone: 'warn'   },
    { icon: '🚫', label: 'Números Bloqueados', value: '1',  delta: 'Requer atenção',         deltaType: 'down', tone: 'danger' },
  ];

  recentChats = [
    { initials: 'JS', name: 'João Silva',     last: 'Quero saber mais sobre o plano…', status: 'Ativo',     statusType: 'green', time: '2m',  color: 'linear-gradient(135deg,#3D6EE8,#4B7BFF)' },
    { initials: 'MR', name: 'Maria Rocha',    last: 'Obrigada pelo retorno!',          status: 'Aguardando', statusType: 'warn',  time: '14m', color: 'linear-gradient(135deg,#F59E0B,#FBBF24)' },
    { initials: 'CA', name: 'Carlos Almeida', last: 'Posso fechar o pedido?',           status: 'Ativo',     statusType: 'green', time: '32m', color: 'linear-gradient(135deg,#22C55E,#4ADE80)' },
    { initials: 'PL', name: 'Paula Lima',     last: 'Estou avaliando a proposta.',      status: 'Ativo',     statusType: 'blue',  time: '1h',  color: 'linear-gradient(135deg,#6366F1,#8B5CF6)' },
    { initials: 'RF', name: 'Ricardo Fontes', last: 'Bom dia, tudo bem?',                status: 'Novo',      statusType: 'blue',  time: '2h',  color: 'linear-gradient(135deg,#EC4899,#F472B6)' },
  ];

  recentDisparos = [
    { name: 'Black Friday 2025', sent: 1240, total: 1500, status: 'Em andamento', statusType: 'blue',  dot: 'on'  },
    { name: 'Boas-vindas',       sent: 320,  total: 320,  status: 'Concluído',    statusType: 'green', dot: 'on'  },
    { name: 'Reativação',        sent: 0,    total: 580,  status: 'Agendado',     statusType: 'warn',  dot: 'warn'},
  ];

  activeFlows = [
    { name: 'Atendimento Inicial', triggers: 87, on: true  },
    { name: 'Qualificação Lead',   triggers: 54, on: true  },
    { name: 'Pós-Venda',           triggers: 12, on: true  },
    { name: 'Carrinho Abandonado', triggers: 0,  on: false },
  ];

  refresh() { console.log('Atualizando dashboard…'); }
}
