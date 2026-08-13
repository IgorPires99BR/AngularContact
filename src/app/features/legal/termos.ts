import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Publica pelo mesmo motivo da politica de privacidade: precisa abrir sem login.
@Component({
  selector: 'app-termos',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './termos.html',
  styleUrls: ['./legal.css'],
})
export class TermosComponent {}
