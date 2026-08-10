import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { HeaderState } from '../template.models';
import { TemplateService } from '../template.service';
import { extrairMensagemErro } from '../../../core/utils/erro-api.util';

@Component({
  selector: 'app-template-header-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-header-editor.html',
  styleUrls: ['../templates.css']
})
export class TemplateHeaderEditorComponent {
  private templateService = inject(TemplateService);

  value = input.required<HeaderState>();
  valueChange = output<HeaderState>();
  empresaId = input<string | undefined>(undefined);
  disabled = input(false);
  uploadingChange = output<boolean>();

  uploadingHeader = signal(false);
  erro = signal('');

  onTipoChange(tipo: string) {
    this.erro.set('');
    this.valueChange.emit({ tipo: tipo as HeaderState['tipo'], texto: '', exemploHandle: '', exemploNomeArquivo: '' });
  }

  onTextoChange(texto: string) {
    this.valueChange.emit({ ...this.value(), texto });
  }

  onArquivoSelecionado(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const arquivo = inputEl.files?.[0];
    if (!arquivo) return;

    const empId = this.empresaId();
    if (!empId) {
      this.erro.set('Empresa não identificada na sessão.');
      return;
    }

    this.uploadingHeader.set(true);
    this.uploadingChange.emit(true);
    this.erro.set('');

    const formData = new FormData();
    formData.append('empresaId', empId);
    formData.append('arquivo', arquivo);

    this.templateService.uploadMidiaExemplo(formData).subscribe({
      next: (res) => {
        this.uploadingHeader.set(false);
        this.uploadingChange.emit(false);
        if (!res?.handle) {
          this.erro.set('Upload concluído, mas a Meta não retornou o identificador do arquivo.');
          return;
        }
        this.valueChange.emit({ ...this.value(), exemploHandle: res.handle, exemploNomeArquivo: arquivo.name });
      },
      error: (err) => {
        this.uploadingHeader.set(false);
        this.uploadingChange.emit(false);
        this.erro.set(extrairMensagemErro(err, 'Falha ao enviar o arquivo.'));
        inputEl.value = '';
      }
    });
  }
}
