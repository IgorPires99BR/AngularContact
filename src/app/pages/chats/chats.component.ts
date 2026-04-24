import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ChatItem {
  id: number;
  initials: string; name: string; phone: string; color: string;
  lastMessage: string; time: string; unread: number; online: boolean;
}
interface Message { from: 'bot' | 'user' | 'step'; text: string; time?: string; }

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chats.component.html',
  styleUrls: ['./chats.component.css'],
})
export class ChatsComponent {
  search = signal('');
  selectedId = signal<number | null>(1);
  draft = signal('');

  chats: ChatItem[] = [
    { id: 1, initials: 'JS', name: 'João Silva',     phone: '+55 11 9 9988-7766', color: 'linear-gradient(135deg,#3D6EE8,#4B7BFF)', lastMessage: 'Quero saber mais sobre o plano…',   time: '2m',  unread: 2, online: true  },
    { id: 2, initials: 'MR', name: 'Maria Rocha',    phone: '+55 21 9 8877-6655', color: 'linear-gradient(135deg,#F59E0B,#FBBF24)', lastMessage: 'Obrigada pelo retorno!',           time: '14m', unread: 0, online: true  },
    { id: 3, initials: 'CA', name: 'Carlos Almeida', phone: '+55 11 9 7766-5544', color: 'linear-gradient(135deg,#22C55E,#4ADE80)', lastMessage: 'Posso fechar o pedido?',            time: '32m', unread: 1, online: false },
    { id: 4, initials: 'PL', name: 'Paula Lima',     phone: '+55 31 9 6655-4433', color: 'linear-gradient(135deg,#6366F1,#8B5CF6)', lastMessage: 'Estou avaliando a proposta.',       time: '1h',  unread: 0, online: false },
    { id: 5, initials: 'RF', name: 'Ricardo Fontes', phone: '+55 41 9 5544-3322', color: 'linear-gradient(135deg,#EC4899,#F472B6)', lastMessage: 'Bom dia, tudo bem?',                 time: '2h',  unread: 3, online: true  },
    { id: 6, initials: 'AM', name: 'Ana Martins',    phone: '+55 51 9 4433-2211', color: 'linear-gradient(135deg,#06B6D4,#22D3EE)', lastMessage: 'Já recebi, obrigada!',               time: '3h',  unread: 0, online: false },
  ];

  messages: Record<number, Message[]> = {
    1: [
      { from: 'step', text: 'Início do flow: Qualificação Lead' },
      { from: 'bot',  text: 'Olá João! Tudo bem? Sou o assistente da Contact Solution 👋', time: '10:32' },
      { from: 'user', text: 'Olá, tudo sim! Quero saber mais sobre o plano Premium', time: '10:33' },
      { from: 'bot',  text: 'Claro! O plano Premium inclui: 10 mil mensagens/mês, 3 números WhatsApp e suporte prioritário. Posso te enviar a apresentação completa?', time: '10:33' },
      { from: 'user', text: 'Pode sim, por favor', time: '10:35' },
    ],
  };

  filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.chats;
    return this.chats.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  });

  selected = computed(() => this.chats.find(c => c.id === this.selectedId()) ?? null);
  selectedMessages = computed(() => this.messages[this.selectedId() ?? 0] ?? []);

  select(id: number) { this.selectedId.set(id); }

  send() {
    const text = this.draft().trim();
    const id = this.selectedId();
    if (!text || id == null) return;
    const list = this.messages[id] ?? [];
    const now = new Date();
    list.push({ from: 'user', text, time: `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}` });
    this.messages[id] = list;
    this.draft.set('');
  }
}
