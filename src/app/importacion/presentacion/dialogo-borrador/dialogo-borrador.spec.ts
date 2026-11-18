import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import { ApiMarcas } from '../../../marcas/aplicacion/puertos';
import { marcaPrueba } from '../../../productos/pruebas/dobles-productos';
import { EstadoImportacion } from '../../aplicacion/estado-importacion';
import { AlmacenImportacionesRecientes, ApiImportaciones } from '../../aplicacion/puertos';
import { Borrador } from '../../dominio/importacion';
import {
  AlmacenRecientesMemoria,
  ApiImportacionesFalsa,
  borradorPrueba,
  crearApiImportacionesFalsa,
  ID_MARCA,
  importacionPrueba,
  paginaBorradoresPrueba,
} from '../../pruebas/dobles-importacion';
import { DialogoBorrador } from './dialogo-borrador';

@Component({
  selector: 'app-anfitrion',
  imports: [DialogoBorrador],
  template: `
    <app-dialogo-borrador
      [(visible)]="visible"
      [borrador]="borrador()"
      (guardado)="guardados.set([...guardados(), $event])"
      (noEditable)="noEditables.set(noEditables() + 1)"
    />
  `,
})
class Anfitrion {
  readonly visible = signal(false);
  readonly borrador = signal<Borrador | null>(null);
  readonly guardados = signal<readonly Borrador[]>([]);
  readonly noEditables = signal(0);
}

describe('DialogoBorrador (RF-PRO-01, RF-PRO-02, D-55)', () => {
  let api: ApiImportacionesFalsa;
  let fixture: ComponentFixture<Anfitrion>;

  const activa = marcaPrueba(ID_MARCA, 'Yanbal');
  const inactiva = marcaPrueba('33333333-3333-4333-8333-333333333333', 'Esika', { activa: false });

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  const campo = <T extends HTMLElement>(selector: string) =>
    document.body.querySelector<T>(selector) as T;
  const boton = (id: string) =>
    document.body.querySelector<HTMLButtonElement>(`[data-prueba="${id}"] button`);

  async function escribir(selector: string, texto: string): Promise<void> {
    const entrada = campo<HTMLInputElement>(selector);
    entrada.value = texto;
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('blur'));
    await estable();
  }

  async function abrir(borrador: Borrador): Promise<void> {
    fixture.componentInstance.borrador.set(borrador);
    fixture.componentInstance.visible.set(true);
    await estable();
  }

  beforeEach(async () => {
    api = crearApiImportacionesFalsa();
    api.obtener.mockResolvedValue(importacionPrueba());
    api.listarBorradores.mockResolvedValue(paginaBorradoresPrueba([]));
    api.editarBorrador.mockImplementation((id, c) =>
      Promise.resolve(borradorPrueba(id, { ...c, advertencias: [] })),
    );
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [
        EstadoMarcas,
        EstadoImportacion,
        { provide: ApiMarcas, useValue: { listar: vi.fn().mockResolvedValue([activa, inactiva]) } },
        { provide: ApiImportaciones, useValue: api },
        { provide: AlmacenImportacionesRecientes, useClass: AlmacenRecientesMemoria },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    await TestBed.inject(EstadoMarcas).cargar();
    await estable();
  });

  afterEach(() => {
    fixture.destroy();
    document.body.querySelectorAll('.p-dialog-mask').forEach((n) => n.remove());
  });

  it('RF-PRO-02: se llena con el borrador y muestra su página y código de origen', async () => {
    await abrir(borradorPrueba('b1', { nombre: 'Crema', precio: '35.00', precioNormal: '44.00' }));
    expect(campo<HTMLInputElement>('#nombre-borrador').value).toBe('Crema');
    expect(campo<HTMLInputElement>('#precio-borrador').value).toBe('35.00');
    expect(document.body.querySelector('[data-prueba="datos-origen"]')?.textContent).toContain('Página 12');
    expect(document.body.querySelector('[data-prueba="datos-origen"]')?.textContent).toContain('$44.00');
  });

  it('RF-PRO-02: guarda solo los campos cambiados, con el precio como texto de 2 decimales', async () => {
    await abrir(borradorPrueba('b1', { nombre: 'Crema', precio: '35.00' }));
    await escribir('#precio-borrador', '12,5');
    boton('guardar')?.click();
    await estable();
    expect(api.editarBorrador).toHaveBeenCalledWith('b1', { precio: '12.50' });
    expect(fixture.componentInstance.guardados()).toHaveLength(1);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('RN-11: un precio con 3 decimales no se envía y se explica junto al campo', async () => {
    await abrir(borradorPrueba('b1', { precio: null, advertencias: ['SIN_PRECIO'] }));
    await escribir('#precio-borrador', '12.505');
    expect(document.body.querySelector('[data-prueba="error-precio"]')?.textContent).toContain('2 decimales');
    expect(boton('guardar')?.disabled).toBe(true);
    expect(api.editarBorrador).not.toHaveBeenCalled();
  });

  it('un borrador sin precio puede guardarse sin tocar el precio (no se envía null)', async () => {
    await abrir(borradorPrueba('b1', { precio: null, advertencias: ['SIN_PRECIO'], nombre: 'Crema' }));
    await escribir('#nombre-borrador', 'Crema nueva');
    boton('guardar')?.click();
    await estable();
    expect(api.editarBorrador).toHaveBeenCalledWith('b1', { nombre: 'Crema nueva' });
  });

  it('solo ofrece marcas activas; una inactiva actual aparece señalada', async () => {
    await abrir(borradorPrueba('b1', { marcaId: inactiva.id }));
    const componente = fixture.debugElement.children[0]?.componentInstance as unknown as {
      opcionesMarca(): { id: string; inactiva: boolean }[];
    };
    expect(componente.opcionesMarca()).toEqual([
      { id: ID_MARCA, nombre: 'Yanbal', inactiva: false },
      { id: inactiva.id, nombre: 'Esika', inactiva: true },
    ]);
  });

  it('400: muestra el error del servidor junto a cada campo', async () => {
    api.editarBorrador.mockRejectedValue(
      new ErrorApi('DATOS_INVALIDOS', 'x', 400, {
        errores: [{ campo: 'nombre', errores: ['El nombre no es válido.'] }],
      }),
    );
    await abrir(borradorPrueba('b1', { nombre: 'Crema' }));
    await escribir('#nombre-borrador', 'Crema nueva');
    boton('guardar')?.click();
    await estable();
    expect(document.body.querySelector('[data-prueba="error-nombre"]')?.textContent).toContain('no es válido');
    expect(document.body.querySelector('[data-prueba="error-general"]')?.textContent).toContain('campos marcados');
    expect(fixture.componentInstance.visible()).toBe(true);
  });

  it('422 BORRADOR_NO_EDITABLE: avisa y pide refrescar la lista', async () => {
    api.editarBorrador.mockRejectedValue(new ErrorApi('BORRADOR_NO_EDITABLE', 'x', 422));
    await abrir(borradorPrueba('b1', { nombre: 'Crema' }));
    await escribir('#nombre-borrador', 'Crema nueva');
    boton('guardar')?.click();
    await estable();
    expect(document.body.querySelector('[data-prueba="error-general"]')?.textContent).toContain('ya no se puede editar');
    expect(fixture.componentInstance.noEditables()).toBe(1);
  });

  it('sin cambios, «Guardar» cierra sin llamar a la API', async () => {
    await abrir(borradorPrueba('b1'));
    boton('guardar')?.click();
    await estable();
    expect(api.editarBorrador).not.toHaveBeenCalled();
    expect(fixture.componentInstance.visible()).toBe(false);
  });
});
