import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Numeros } from './numeros';

describe('Numeros', () => {
  let component: Numeros;
  let fixture: ComponentFixture<Numeros>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Numeros]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Numeros);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
