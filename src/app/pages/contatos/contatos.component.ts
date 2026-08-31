import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { isEmailValido } from '../../shared/utils/validators';
import { extrairMensagemErro } from '../../core/utils/erro-api.util';

interface Contato {
  id?: string;
  usuarioId: string;
  telefone: string;
  nome?: string;
  email?: string;
  dataCriacao?: string;
  // Preenchido so quando o contato chegou por um anuncio Click-to-WhatsApp -- null pra quem
  // foi cadastrado manualmente ou escreveu organicamente.
  origemAnuncio?: string | null;
  origemData?: string | null;
}

@Component({
  selector: 'app-contatos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contatos.component.html',
  styleUrls: ['../shared-crud.css', './contatos.component.css'],
})
export class ContatosComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private userId = this.authService.usuarioIdSignal;
  private empresaId = this.authService.empresaIdSignal;

  private readonly API_URL = `${environment.apiUrl}/contato`;

  form = signal({
    nome: '',
    telefone: '',
    email: '',
  });

  search = signal('');
  editingId = signal<string | null>(null);
  response = signal('');
  contatos = signal<Contato[]>([]);

  contatosFiltrados = computed(() => {
    const termo = this.search().toLowerCase().trim();
    if (!termo) return this.contatos();
    return this.contatos().filter(c =>
      (c.nome && c.nome.toLowerCase().includes(termo)) ||
      c.telefone.toLowerCase().includes(termo) ||
      (c.email && c.email.toLowerCase().includes(termo))
    );
  });

  ngOnInit() {
    this.buscar();
  }

  update(field: string, value: string) {
    this.form.set({ ...this.form(), [field]: value });
  }

  // Aceita só dígitos (formato E.164: DDI+DDD+número, até 15 dígitos). Escreve
  // direto no elemento pra não depender do timing do change detection do Angular.
  updateSomenteNumeros(field: string, input: HTMLInputElement, maxDigitos: number) {
    const apenasDigitos = input.value.replace(/\D/g, '').slice(0, maxDigitos);
    input.value = apenasDigitos;
    this.form.set({ ...this.form(), [field]: apenasDigitos });
  }

  buscar() {
    const id = this.userId();
    if (!id) {
      this.response.set('⚠ Usuário não identificado no sistema.');
      return;
    }

    this.http.get<Contato[]>(`${this.API_URL}/obter-por-usuario/${id}`)
      .subscribe({
        next: (res) => {
          this.contatos.set(res);
          this.response.set(res.length > 0 ? `✅ ${res.length} contatos encontrados` : '⚠ Nenhum contato.');
        },
        error: (err) => {
          this.response.set(`❌ ${extrairMensagemErro(err, 'Erro na requisição. Verifique o console.')}`);
        }
      });
  }

  incluir() {
    const f = this.form();
    const currentUserId = this.userId();

    if (!f.telefone || f.telefone.length < 10) {
      this.response.set('❌ Telefone inválido. Informe DDI + DDD + número (mínimo 10 dígitos).');
      return;
    }

    if (f.email && !isEmailValido(f.email)) {
      this.response.set('❌ E-mail inválido.');
      return;
    }

    if (!currentUserId) {
      this.response.set('❌ Sessão expirada. Faça login novamente.');
      return;
    }

    const payload: Contato = {
      ...f,
      usuarioId: currentUserId
    };

    const request = this.editingId()
      ? this.http.put(`${this.API_URL}/alterar`, { id: this.editingId(), ...payload })
      : this.http.post(`${this.API_URL}/incluir`, payload);

    request.subscribe({
      next: () => {
        this.response.set('✅ Operação realizada!');
        this.cancelarEdicao();
        this.buscar();
      },
      error: (err) => this.response.set(`❌ Erro: ${extrairMensagemErro(err)}`)
    });
  }

  // PROCESSAMENTO NATIVO DE ARQUIVO CSV (Sem módulos extras)
  importarCsv(event: any) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const currentUserId = this.userId();
    const currentEmpresaId = this.empresaId();

    if (!currentUserId) {
      this.response.set('❌ Sessão inválida para importação.');
      return;
    }

    this.response.set('⏳ Lendo arquivo CSV...');
    const file = target.files[0];
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const text = e.target.result as string;

        // Divide o arquivo por quebras de linha (suporta \n e \r\n)
        const lines = text.split(/\r?\n/);
        const contatosMapeados: any[] = [];

        lines.forEach((line: string) => {
          if (!line.trim()) return;

          // Divide a linha aceitando ponto e vírgula (padrão PT-BR) ou vírgula (padrão EN)
          const columns = line.split(/[;,]/);

          // Remove aspas que o Excel costuma colocar em volta das strings
          const telefone = columns[0]?.replace(/["']/g, '').trim();
          const nome = columns[1]?.replace(/["']/g, '').trim() || null;

          // Validação: Ignora cabeçalhos ("telefone", "nome") ou registros sem número válido
          if (!telefone || isNaN(Number(telefone.replace(/[+\-\s()]/g, ''))) || telefone.toLowerCase() === 'telefone') {
            return;
          }

          contatosMapeados.push({
            nome: nome,
            telefone: telefone
          });
        });

        if (contatosMapeados.length === 0) {
          this.response.set('❌ Nenhum contato válido encontrado no arquivo CSV.');
          target.value = '';
          return;
        }

        // Monta o payload conforme a estrutura do seu Backend (CriaContatoEmLoteCommand)
        const payload = {
          idEmpresa: currentEmpresaId || '00000000-0000-0000-0000-000000000000',
          usuarioId: currentUserId,
          contatos: contatosMapeados
        };

        this.response.set(`⏳ Enviando ${contatosMapeados.length} contatos ao servidor...`);

        this.http.post(`${this.API_URL}/incluir-em-lote`, payload).subscribe({
          next: () => {
            this.response.set(`✅ Sucesso! ${contatosMapeados.length} contatos importados.`);
            this.buscar(); // Atualiza o grid da tela
            target.value = ''; // Reseta o input file
          },
          error: (err) => {
            this.response.set(`❌ Falha na api: ${extrairMensagemErro(err, 'Erro ao salvar o lote.')}`);
            target.value = '';
          }
        });

      } catch (err) {
        console.error(err);
        this.response.set('❌ Falha ao processar as linhas do arquivo CSV.');
        target.value = '';
      }
    };

    // Lê explicitamente como UTF-8 para não quebrar acentuações dos nomes
    reader.readAsText(file, 'UTF-8');
  }

  prepararEdicao(c: Contato) {
    this.editingId.set(c.id!);
    this.form.set({
      nome: c.nome || '',
      telefone: c.telefone,
      email: c.email || ''
    });
  }

  cancelarEdicao() {
    this.editingId.set(null);
    this.form.set({ nome: '', telefone: '', email: '' });
  }

  excluir(id: string) {
    if (!confirm('Deseja excluir este contato?')) return;

    this.http.delete(`${this.API_URL}/excluir/${id}`).subscribe({
      next: () => {
        this.contatos.update(lista => lista.filter(c => c.id !== id));
        this.response.set('✅ Contato excluído.');
      },
      error: (err) => this.response.set(`❌ Erro ao excluir: ${extrairMensagemErro(err)}`)
    });
  }
}
