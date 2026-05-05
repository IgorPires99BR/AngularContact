import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';

type NumStatus = 'ativo' | 'pendente' | 'bloqueado';

declare var FB: any;

interface Numero {
  id: string;
  usuarioId: string;
  numeroTelefone: string;
  descricao: string;
  instanciaId: string;
  status?: NumStatus;
  dataCriacao?: string;
}

@Component({
  selector: 'app-numeros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './numeros.component.html',
  styleUrls: ['../shared-crud.css', './numeros.component.css'],
})



export class NumerosComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly API_URL = 'https://localhost:7118/api/numero';



  private userId = this.authService.usuarioIdSignal;

  form = signal({
    numeroTelefone: '',
    descricao: '',
    instanciaId: '',
    status: 'ativo' as NumStatus
  });

  response = signal('');
  numeros = signal<Numero[]>([]);

  // Stats baseados nos dados da API
  ativos = computed(() => this.numeros().filter(n => n.status === 'ativo').length);
  pendentes = computed(() => this.numeros().filter(n => n.status === 'pendente').length);
  bloqueados = computed(() => this.numeros().filter(n => n.status === 'bloqueado').length);

  ngOnInit() {
    this.buscar();
  }

  update(field: string, value: any) {
    this.form.set({ ...this.form(), [field]: value });
  }

  buscar() {
    const uid = this.userId();
    if (!uid) return;

    this.http.get<Numero[]>(`${this.API_URL}/obter-por-usuario/${uid}`)
      .subscribe({
        next: (res) => this.numeros.set(res),
        error: (err) => this.response.set('❌ Erro ao buscar dados.')
      });
  }

  incluir() {
    const f = this.form();
    const uid = this.userId();

    if (!f.numeroTelefone || !uid) {
      this.response.set('❌ Preencha os campos obrigatórios.');
      return;
    }

    const payload = {
      usuarioId: uid,
      numeroTelefone: f.numeroTelefone,
      descricao: f.descricao,
      instanciaId: f.instanciaId
    };

    this.http.post(`${this.API_URL}/incluir`, payload).subscribe({
      next: () => {
        this.response.set('✅ Número incluído com sucesso!');
        this.limparForm();
        this.buscar();
      },
      error: () => this.response.set('❌ Erro ao incluir na API.')
    });
  }

  excluir(id: string) {
    if (!confirm('Deseja excluir este número?')) return;
    this.http.delete(`${this.API_URL}/excluir/${id}`).subscribe(() => {
      this.numeros.update(list => list.filter(n => n.id !== id));
    });
  }

  iniciarEmbeddedSignup() {
    FB.login((response: any) => {
      if (response.authResponse) {
        const code = response.authResponse.code;
        // Esse 'code' ou 'accessToken' deve ser enviado para o seu C#
        this.vincularContaMeta(response.authResponse.accessToken);
      } else {
        this.response.set('❌ Onboarding cancelado pelo usuário.');
      }
    }, {
      // Escopos necessários para gerenciar o WhatsApp do cliente
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      extras: {
        feature: 'whatsapp_embedded_signup',
        setup: {
          // Aqui você pode pré-configurar dados se desejar
        }
      }
    });
  }

  vincularContaMeta(token: string) {
    this.response.set('⏳ Vinculando conta e buscando números...');

    // Envia o Token para o seu Backend C# fazer o "Scan" dos números
    this.http.post(`${this.API_URL}/vincular-meta`, { token }).subscribe({
      next: (res: any) => {
        this.response.set('✅ Conta vinculada! Atualizando lista...');
        this.buscar(); // Atualiza a lista de números agora com os novos importados
      },
      error: () => this.response.set('❌ Erro ao processar dados da Meta.')
    });
  }

  private limparForm() {
    this.form.set({ numeroTelefone: '', descricao: '', instanciaId: '', status: 'ativo' });
  }

  badgeClass(s?: NumStatus) {
    const classes = { ativo: 'badge-green', pendente: 'badge-warn', bloqueado: 'badge-danger' };
    return s ? classes[s] : 'badge-green';
  }
}
