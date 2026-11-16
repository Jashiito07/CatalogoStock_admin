import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';

import { AlmacenTokenRenovacion, ApiAutenticacion } from '../../../usuarios/aplicacion/puertos';
import { SesionVendedor } from '../../../usuarios/aplicacion/sesion-vendedor';
import {
  AlmacenEnMemoria,
  ApiAutenticacionFalsa,
  crearApiFalsa,
  crearSesion,
} from '../../../usuarios/pruebas/dobles-sesion';
import { Inicio } from './inicio';

describe('Inicio', () => {
  let mensajes: MessageService;
  let api: ApiAutenticacionFalsa;

  beforeEach(async () => {
    api = crearApiFalsa();
    await TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [
        MessageService,
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: new AlmacenEnMemoria() },
      ],
    }).compileComponents();
    mensajes = TestBed.inject(MessageService);
  });

  it('D-50: sin sesión no muestra el aviso «Verifica tu correo»', async () => {
    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-verificar-correo')).toBeNull();
  });

  it('D-50: con el correo sin verificar muestra «Verifica tu correo» y lo oculta al verificarlo', async () => {
    const sesion = crearSesion();
    api.ingresarVendedor.mockResolvedValue(sesion);
    const servicio = TestBed.inject(SesionVendedor);
    await servicio.ingresar(sesion.usuario.correo, 'Clave2026');

    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.querySelector('app-verificar-correo')?.textContent).toContain('Verifica tu correo');
    expect(elemento.textContent).toContain(sesion.usuario.correo);

    servicio.actualizarUsuario({ ...sesion.usuario, correoVerificadoEn: '2026-11-15T10:00:00.000Z' });
    await fixture.whenStable();
    expect(elemento.querySelector('app-verificar-correo')).toBeNull();
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
