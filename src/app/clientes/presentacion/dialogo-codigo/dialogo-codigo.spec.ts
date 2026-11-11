import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { Mock } from 'vitest';

import { Portapapeles } from '../../aplicacion/puertos';
import { CodigoRecuperacion } from '../../dominio/cliente';
import {
  AVISO_CODIGO_UNICO,
  DialogoCodigo,
  MENSAJE_CODIGO_COPIADO,
  MENSAJE_NO_SE_PUDO_COPIAR,
} from './dialogo-codigo';

const CODIGO: CodigoRecuperacion = {
  codigo: '482913',
  venceEn: '2026-11-09T15:30:00Z',
  cliente: {
    id: '6f1c0000-0000-4000-8000-000000000001',
    nombre: 'María Zambrano',
    correo: 'maria.zambrano@correo.com',
  },
};

describe('DialogoCodigo (RF-USU-05, D-39)', () => {
  let fixture: ComponentFixture<DialogoCodigo>;
  let copiar: Mock<(texto: string) => Promise<void>>;
  let avisos: MessageService;

  beforeEach(async () => {
    copiar = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [DialogoCodigo],
      providers: [MessageService, { provide: Portapapeles, useValue: { copiar } }],
    }).compileComponents();
    avisos = TestBed.inject(MessageService);
    fixture = TestBed.createComponent(DialogoCodigo);
  });

  async function mostrar(codigo: CodigoRecuperacion | null): Promise<void> {
    fixture.componentRef.setInput('codigo', codigo);
    await fixture.whenStable();
  }

  const dialogo = () => document.body.querySelector<HTMLElement>('[data-prueba="dialogo-codigo"]');
  const texto = (prueba: string) =>
    document.body.querySelector(`[data-prueba="${prueba}"]`)?.textContent?.trim();

  afterEach(() => fixture.destroy());

  it('sin código no muestra nada', async () => {
    await mostrar(null);
    expect(dialogo()).toBeNull();
  });

  it('muestra el código grande, el cliente, el vencimiento en hora de Ecuador y la nota', async () => {
    await mostrar(CODIGO);

    expect(texto('codigo')).toBe('482913');
    expect(texto('nombre-cliente')).toBe('María Zambrano');
    // 15:30 UTC → 10:30 en Ecuador.
    expect(texto('vencimiento')).toContain('Vence a las 10:30');
    expect(dialogo()?.textContent).toContain(AVISO_CODIGO_UNICO);
    expect(
      document.body.querySelector('[data-prueba="codigo"]')?.getAttribute('aria-label'),
    ).toBe('Código: 4 8 2 9 1 3');
  });

  it('«Copiar» copia el código y avisa con un toast', async () => {
    const agregar = vi.spyOn(avisos, 'add');
    await mostrar(CODIGO);

    document.body.querySelector<HTMLButtonElement>('[data-prueba="copiar-codigo"] button')?.click();
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));

    expect(copiar).toHaveBeenCalledWith('482913');
    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: MENSAJE_CODIGO_COPIADO }),
    );
  });

  it('si el navegador no permite copiar, pide copiarlo a mano', async () => {
    copiar.mockRejectedValue(new Error('sin permiso'));
    const agregar = vi.spyOn(avisos, 'add');
    await mostrar(CODIGO);

    document.body.querySelector<HTMLButtonElement>('[data-prueba="copiar-codigo"] button')?.click();
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));

    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: MENSAJE_NO_SE_PUDO_COPIAR }),
    );
  });

  it('al cerrar avisa al padre para descartar el código', async () => {
    const cerrado = vi.fn();
    fixture.componentInstance.cerrado.subscribe(cerrado);
    await mostrar(CODIGO);

    const cerrar = Array.from(document.body.querySelectorAll('button')).find(
      (boton) => boton.textContent?.trim() === 'Cerrar',
    );
    cerrar?.click();
    await fixture.whenStable();

    expect(cerrado).toHaveBeenCalledTimes(1);
  });

  it('no guarda el código en el almacenamiento del navegador', async () => {
    await mostrar(CODIGO);
    const guardado = [
      ...Object.values({ ...sessionStorage }),
      ...Object.values({ ...localStorage }),
    ].join('|');
    expect(guardado).not.toContain('482913');
  });
});
