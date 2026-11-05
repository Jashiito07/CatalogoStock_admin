import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';

import { Inicio } from './inicio';

describe('Inicio', () => {
  let mensajes: MessageService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [MessageService],
    }).compileComponents();
    mensajes = TestBed.inject(MessageService);
  });

  it('muestra la bienvenida, los botones primario y secundario y la insignia de la fase', async () => {
    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.textContent).toContain('Bienvenido al panel del vendedor');
    const botones = Array.from(elemento.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(botones).toContain('Mostrar aviso de prueba');
    expect(botones).toContain('Ver colores corporativos');
    expect(elemento.querySelector('p-badge')?.textContent).toContain('Base técnica');
  });

  it('RNF-12: da retroalimentación con un aviso (p-toast) al pulsar la acción principal', async () => {
    const espia = vi.spyOn(mensajes, 'add');
    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();

    const boton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Mostrar aviso de prueba'),
    );
    boton?.click();

    expect(espia).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', detail: 'El tema corporativo del panel está activo.' }),
    );
  });
});
