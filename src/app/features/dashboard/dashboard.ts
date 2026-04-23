// dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  kpis = { msgHoje: 0, taxaEntrega: 0, leads: 0, chatsAtivos: 0, numAtivos: 0, numPendentes: 0, numBloqueados: 0 };

  recentChats = [
    { id: 1, name: 'Ana Lima', initials: 'AL', color: '#0066CC', lastMessage: 'Quero saber mais sobre o plano Pro...', time: '14:32', unread: 2, status: 'Ativo', statusClass: 'success' },
    { id: 2, name: 'Pedro Costa', initials: 'PC', color: '#00A876', lastMessage: 'Ok, aguardo retorno do consultor.', time: '14:18', unread: 0, status: 'Aguardando', statusClass: 'warn' },
    { id: 3, name: 'Juliana Rocha', initials: 'JR', color: '#7C3AED', lastMessage: 'Preciso cancelar meu pedido #4521', time: '13:55', unread: 1, status: 'Urgente', statusClass: 'danger' },
    { id: 4, name: 'Carlos Mendes', initials: 'CM', color: '#0284C7', lastMessage: 'Obrigado pelo atendimento!', time: '13:40', unread: 0, status: 'Encerrado', statusClass: 'neutral' },
    { id: 5, name: 'Marina Souza', initials: 'MS', color: '#DC2626', lastMessage: 'Quando chega meu pedido?', time: '13:22', unread: 3, status: 'Novo', statusClass: 'info' },
  ];

  recentDisparos = [
    { nome: 'Black Friday Week', data: 'Hoje 13:00', enviados: 4280, status: 'Concluído', statusClass: 'success' },
    { nome: 'Promoção Maio', data: 'Hoje 10:30', enviados: 1850, status: 'Concluído', statusClass: 'success' },
    { nome: 'Lembrete Renovação', data: 'Ontem', enviados: 312, status: 'Parcial', statusClass: 'warn' },
  ];

  activeFlows = [
    { nome: 'Boas-vindas Automático', status: 'on', statusLabel: 'Ativo', badgeClass: 'success', clientes: 34 },
    { nome: 'Qualificação de Lead', status: 'on', statusLabel: 'Ativo', badgeClass: 'success', clientes: 18 },
    { nome: 'Suporte Técnico', status: 'paused', statusLabel: 'Pausado', badgeClass: 'warn', clientes: 7 },
  ];

  constructor(private router: Router) { }

  ngOnInit() { this.animateKpis(); }

  animateKpis() {
    const targets = { msgHoje: 1247, taxaEntrega: 98, leads: 93, chatsAtivos: 12, numAtivos: 5, numPendentes: 2, numBloqueados: 1 };
    const steps = 40;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      const progress = i / steps;
      Object.keys(targets).forEach(k => {
        const key = k as keyof typeof targets;
        this.kpis[key] = Math.round(targets[key] * Math.min(progress, 1));
      });
      if (i >= steps) clearInterval(interval);
    }, 25);
  }

  refresh() { this.kpis = { msgHoje: 0, taxaEntrega: 0, leads: 0, chatsAtivos: 0, numAtivos: 0, numPendentes: 0, numBloqueados: 0 }; this.animateKpis(); }

  goToChat(chat: any) { this.router.navigate(['/app/chats'], { queryParams: { id: chat.id } }); }
}
