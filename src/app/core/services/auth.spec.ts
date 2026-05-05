import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService]
    });
    service = TestBed.inject(AuthService);

    // Limpa o localStorage antes de cada teste para evitar interferência
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('deve iniciar com usuarioId nulo se o localStorage estiver vazio', () => {
    expect(service.usuarioId()).toBeNull();
    expect(service.isAutenticado()).toBeFalse();
  });

  it('deve definir a sessão corretamente e atualizar o signal', () => {
    const mockId = 123;
    service.setSession(mockId);

    expect(service.usuarioId()).toBe(mockId);
    expect(service.isAutenticado()).toBeTrue();
    expect(localStorage.getItem('usuarioId')).toBe('123');
  });

  it('deve limpar os dados ao fazer logout', () => {
    service.setSession(456);
    service.logout();

    expect(service.usuarioId()).toBeNull();
    expect(localStorage.getItem('usuarioId')).toBeNull();
  });
});
