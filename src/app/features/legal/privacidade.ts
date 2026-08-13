import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Pagina publica: fica fora do authGuard de proposito. O revisor da Meta exige a URL
// da politica de privacidade acessivel sem login, e o titular de dados tambem precisa
// conseguir abrir sem ter conta na plataforma.
@Component({
  selector: 'app-privacidade',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacidade.html',
  styleUrls: ['./legal.css'],
})
export class PrivacidadeComponent {}
