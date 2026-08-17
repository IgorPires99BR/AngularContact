import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Globe3dComponent } from '../../shared/globe3d/globe3d';

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  ctaLabel: string;
  // Link de checkout na Cakto. Ausente = plano sob consulta, que continua indo pro contato.
  checkoutUrl?: string;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface Diferencial {
  titulo: string;
  descricao: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, Globe3dComponent],
  templateUrl: './landing.html',
  styleUrls: ['./landing.css'],
})
export class LandingComponent {
  readonly features: Feature[] = [
    {
      icon: '⚡',
      title: 'Automação em Tempo Real',
      description: 'Crie fluxos de atendimento que respondem sozinhos, 24 horas por dia, sem perder o toque humano.',
    },
    {
      icon: '💬',
      title: 'WhatsApp & Meta integrados',
      description: 'Centralize conversas de múltiplos números e canais em uma única caixa de entrada compartilhada.',
    },
    {
      icon: '📊',
      title: 'Dashboard de Conversão',
      description: 'Acompanhe métricas de resposta, conversão e desempenho da equipe em tempo real.',
    },
    {
      icon: '📣',
      title: 'Disparo em Massa',
      description: 'Envie campanhas segmentadas para milhares de contatos respeitando limites e boas práticas.',
    },
    {
      icon: '👥',
      title: 'Times & Permissões',
      description: 'Organize usuários por empresa, defina permissões e distribua atendimentos automaticamente.',
    },
    {
      icon: '🔒',
      title: 'Segurança de Dados',
      description: 'Infraestrutura com alta disponibilidade e boas práticas de proteção das informações dos seus clientes.',
    },
  ];

  readonly plans: Plan[] = [
    {
      name: 'Starter',
      price: 'R$ 197',
      period: '/mês',
      description: 'Para times pequenos que estão começando a automatizar o atendimento.',
      features: [
        '1 número de WhatsApp',
        'Até 3 usuários',
        '2.000 mensagens/mês',
        'Automações básicas',
        'Suporte por e-mail',
      ],
      ctaLabel: 'Começar agora',
      checkoutUrl: 'https://pay.cakto.com.br/pw7sssc_1045806',
    },
    {
      name: 'Pro',
      price: 'R$ 497',
      period: '/mês',
      description: 'Para empresas em crescimento que precisam de escala e automação avançada.',
      features: [
        'Até 3 números de WhatsApp',
        'Até 10 usuários',
        '15.000 mensagens/mês',
        'Fluxos de automação avançados',
        'Webhook Meta integrado',
        'Suporte prioritário',
      ],
      highlighted: true,
      ctaLabel: 'Assinar Pro',
      checkoutUrl: 'https://pay.cakto.com.br/qftc9dx',
    },
    {
      name: 'Enterprise',
      price: 'Sob consulta',
      period: '',
      description: 'Para operações de alto volume com necessidades personalizadas.',
      features: [
        'Números ilimitados',
        'Usuários ilimitados',
        'Volume de mensagens sob demanda',
        'Automações e integrações sob medida',
        'Gerente de conta dedicado',
        'SLA de disponibilidade em contrato',
      ],
      ctaLabel: 'Falar com vendas',
    },
  ];

  // Fatos verificaveis do produto no lugar de depoimentos inventados: os tres anteriores
  // eram assinados por pessoas que nao existem, o que derruba a credibilidade da pagina
  // (e e exatamente o tipo de coisa que a analise da Meta olha).
  // O checkout roda no dominio da Cakto, onde nosso pixel nao alcanca. Marcar o clique aqui
  // e o que permite a Meta ligar "quem clicou em assinar" ao anuncio -- a compra em si e
  // reportada pelo servidor, quando o webhook confirma o pagamento.
  registrarCliqueCheckout(plan: Plan): void {
    const fbq = (window as any).fbq;
    if (typeof fbq !== 'function') return;

    fbq('track', 'InitiateCheckout', {
      content_name: plan.name,
      value: Number((plan.price || '').replace(/[^\d]/g, '')) || undefined,
      currency: 'BRL',
    });
  }

  readonly diferenciais: Diferencial[] = [
    {
      titulo: 'Seu número, sua conta na Meta',
      descricao: 'A conexão é feita na sua própria WhatsApp Business Account — o número e o histórico continuam seus.',
    },
    {
      titulo: 'Você paga a mensagem direto à Meta',
      descricao: 'Sem intermediação nem markup por conversa: aqui você paga só a assinatura da plataforma.',
    },
    {
      titulo: 'Atendimento humano e automático no mesmo lugar',
      descricao: 'O robô conduz a conversa e o vendedor assume quando quiser, sem perder o histórico.',
    },
  ];

  readonly faqs: FaqItem[] = [
    {
      question: 'Preciso ter um número de WhatsApp Business já aprovado?',
      answer: 'Não necessariamente. Ajudamos na configuração e verificação do seu número junto à Meta durante o onboarding.',
    },
    {
      question: 'Consigo migrar de plano depois?',
      answer: 'Sim, você pode fazer upgrade ou downgrade do seu plano a qualquer momento diretamente com nosso time.',
    },
    {
      question: 'Existe fidelidade ou contrato mínimo?',
      answer: 'Os planos Starter e Pro são mensais, sem fidelidade. O plano Enterprise é negociado conforme a necessidade da operação.',
    },
    {
      question: 'A plataforma oferece suporte em português?',
      answer: 'Sim, todo o suporte é feito em português, com time dedicado para dúvidas técnicas e comerciais.',
    },
  ];
}
