import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// A Meta pede uma URL de instrucoes de exclusao de dados na configuracao do app.
// Publica e sem login, porque quem pede exclusao frequentemente ja nao tem acesso.
@Component({
  selector: 'app-exclusao-dados',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './exclusao-dados.html',
  styleUrls: ['./legal.css'],
})
export class ExclusaoDadosComponent {}
