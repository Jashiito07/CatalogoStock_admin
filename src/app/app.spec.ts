import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageService } from 'primeng/api';

import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), MessageService],
    }).compileComponents();
  });

  it('se crea', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('redirige la raíz a la página de Inicio dentro del diseño del panel', async () => {
    const arnes = await RouterTestingHarness.create('/');
    const raiz = arnes.routeNativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Bienvenido al panel del vendedor');
  });
});
