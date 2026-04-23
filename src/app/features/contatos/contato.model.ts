export interface Contato {
  id?: number;
  nome: string;
  telefone: string;
  usuarioId: number; // Chave estrangeira que vimos na sua API
}
