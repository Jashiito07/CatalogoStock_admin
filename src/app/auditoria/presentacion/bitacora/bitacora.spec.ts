import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Mock } from 'vitest';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { LectorBitacora } from '../../aplicacion/puertos';
import { ConsultaBitacora, PaginaBitacora, RegistroActividad } from '../../dominio/bitacora';
import { aFilaBitacora, Bitacora, MENSAJE_SIN_PERMISO } from './bitacora';

const ID_CLIENTE = '6f1c0000-0000-4000-8000-000000000001';
const ID_ELIMINADO = '6f1c0000-0000-4000-8000-000000000002';

const REGISTROS: RegistroActividad[] = [
  {
    id: 'r1',
    fecha: '2026-11-05T15:16:02.000Z',
    accion: 'SESION_INICIADA',
    usuario: { id: ID_CLIENTE, nombre: 'María Zambrano', rol: 'CLIENTE' },
    entidad: 'SESION',
    idEntidad: 'a41d0000-0000-4000-8000-000000000000',
    detalle: { rol: 'CLIENTE', canal: 'APP' },
  },
  {
    id: 'r2',
    fecha: '2026-11-05T04:30:00.000Z',
    accion: 'SESION_FALLIDA',
    usuario: null,
    entidad: 'SESION',
    idEntidad: null,
    detalle: { correo: 'nadie@correo.com', canal: 'PANEL', motivo: 'CREDENCIALES_INVALIDAS' },
  },
  {
    id: 'r3',
    fecha: '2026-11-04T12:00:00.000Z',
    accion: 'USUARIO_REGISTRADO',
    usuario: { id: ID_ELIMINADO, nombre: 'Usuario eliminado', rol: null },
    entidad: 'USUARIO',
    idEntidad: ID_ELIMINADO,
    detalle: { rol: 'CLIENTE' },
  },
];

function pagina(elementos: RegistroActividad[], total = elementos.length): PaginaBitacora {
  return { elementos, pagina: 1, tamanio: 20, total };
}

describe('Bitacora (RF-USU-04)', () => {
  let consultar: Mock<(consulta: ConsultaBitacora) => Promise<PaginaBitacora>>;
  let fixture: ComponentFixture<Bitacora>;
  let elemento: HTMLElement;

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    consultar = vi.fn().mockResolvedValue(pagina(REGISTROS, 57));
    await TestBed.configureTestingModule({
      imports: [Bitacora],
      providers: [{ provide: LectorBitacora, useValue: { consultar } }],
    }).compileComponents();
    fixture = TestBed.createComponent(Bitacora);
    elemento = fixture.nativeElement as HTMLElement;
    await estable();
  });

  const componente = () => fixture.componentInstance;
  const ultimaConsulta = () => consultar.mock.calls.at(-1)?.[0];
  const filas = () => Array.from(elemento.querySelectorAll('[data-prueba="fila-bitacora"]'));

  it('carga la primera página al abrir (pagina 1, tamanio 20)', () => {
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20 });
    expect(elemento.textContent).toContain('1 a 20 de 57 actividades');
  });

  it('muestra las fechas en hora de Ecuador y las acciones en español', () => {
    const textos = filas().map((fila) => fila.textContent ?? '');
    expect(textos).toHaveLength(3);
    // 15:16:02 UTC → 10:16:02 en Ecuador; 04:30 UTC del 5 → 23:30 del 4 en Ecuador.
    expect(textos[0]).toContain('05/11/2026 10:16:02');
    expect(textos[1]).toContain('04/11/2026 23:30:00');
    expect(textos[0]).toContain('Sesión iniciada');
    expect(textos[1]).toContain('Ingreso fallido');
    expect(textos[1]).toContain('Correo intentado');
    expect(textos[1]).toContain('nadie@correo.com');
  });

  it('usuario null → «No identificado»; usuario eliminado (D-30) → «Usuario eliminado» sin rol', () => {
    const usuarios = filas().map((fila) =>
      fila.querySelector('[data-prueba="usuario"]')?.textContent?.trim(),
    );
    expect(usuarios).toEqual(['María Zambrano', 'No identificado', 'Usuario eliminado']);
    expect(filas()[0].textContent).toContain('Cliente');
    // Sin usuario no hay botón para filtrar; con usuario eliminado sí (tiene id).
    expect(filas()[1].querySelector('button')).toBeNull();
    expect(filas()[2].querySelector('button')).not.toBeNull();
  });

  it('pagina en el servidor: la página 3 de 20 pide pagina=3', async () => {
    componente()['alCargarPagina']({ first: 40, rows: 20 });
    await estable();
    expect(ultimaConsulta()).toEqual({ pagina: 3, tamanio: 20 });

    componente()['alCargarPagina']({ first: 0, rows: 50 });
    await estable();
    expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 50 });
  });

  it('D-31: aplica los filtros de acción y fecha con hora y zona -05:00 y vuelve a la página 1', async () => {
    componente()['alCargarPagina']({ first: 40, rows: 20 });
    componente()['filtros'].setValue({
      accion: 'SESION_FALLIDA',
      desde: new Date(2026, 10, 1),
      hasta: new Date(2026, 10, 5),
    });
    elemento.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click();
    await estable();

    expect(ultimaConsulta()).toEqual({
      pagina: 1,
      tamanio: 20,
      accion: 'SESION_FALLIDA',
      desde: '2026-11-01T00:00:00.000-05:00',
      hasta: '2026-11-05T23:59:59.999-05:00',
    });
  });

  it('no consulta si «hasta» es anterior a «desde» y lo explica', async () => {
    const llamadas = consultar.mock.calls.length;
    componente()['filtros'].setValue({
      accion: null,
      desde: new Date(2026, 10, 5),
      hasta: new Date(2026, 10, 4),
    });
    elemento.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click();
    await estable();

    expect(consultar.mock.calls.length).toBe(llamadas);
    expect(elemento.textContent).toContain('La fecha «Hasta» debe ser igual o posterior');
  });

  it('filtra por usuario desde la fila y permite quitar el filtro', async () => {
    filas()[0].querySelector('button')?.click();
    await estable();

    expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20, idUsuario: ID_CLIENTE });
    expect(elemento.textContent).toContain('Mostrando solo las actividades de:');
    expect(elemento.querySelector('p-chip')?.textContent).toContain('María Zambrano');

    componente()['quitarFiltroUsuario']();
    await estable();
    expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20 });
  });

  it('CA-11: sin resultados con filtros ofrece «Limpiar filtros»', async () => {
    consultar.mockResolvedValue(pagina([]));
    componente()['filtros'].controls.accion.setValue('ACCESO_DENEGADO');
    elemento.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click();
    await estable();

    const vacio = elemento.querySelector('[data-prueba="bitacora-vacia"]');
    expect(vacio?.textContent).toContain('No hay actividades con estos filtros.');
    vacio?.querySelector('button')?.click();
    await estable();
    expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20 });
  });

  it('CA-02: un 403 muestra «No tienes permiso» y permite reintentar', async () => {
    consultar.mockRejectedValue(
      new ErrorApi('NO_AUTORIZADO', 'No tiene permiso para esta acción.', 403),
    );
    await componente().cargar();
    await estable();

    expect(elemento.textContent).toContain(MENSAJE_SIN_PERMISO);
    consultar.mockResolvedValue(pagina(REGISTROS));
    Array.from(elemento.querySelectorAll('button'))
      .find((boton) => boton.textContent?.includes('Reintentar'))
      ?.click();
    await estable();
    expect(elemento.textContent).not.toContain(MENSAJE_SIN_PERMISO);
    expect(filas()).toHaveLength(3);
  });

  it('RF-USU-05: el filtro de acción incluye las acciones de recuperación y cambio de clave', () => {
    const opciones = componente()['opcionesAccion'];
    for (const [valor, etiqueta] of [
      ['CODIGO_RECUPERACION_GENERADO', 'Código de recuperación generado'],
      ['CLAVE_RESTABLECIDA', 'Clave restablecida'],
      ['RECUPERACION_FALLIDA', 'Recuperación de clave fallida'],
      ['CLAVE_CAMBIADA', 'Clave cambiada'],
    ]) {
      expect(opciones).toContainEqual({ valor, etiqueta });
    }
  });

  it('muestra el mensaje del contrato sin detalles técnicos si la API no responde', async () => {
    consultar.mockRejectedValue(new ErrorApi('SIN_CONEXION', 'No se pudo conectar con el servidor.', 0));
    await componente().cargar();
    await estable();
    expect(elemento.textContent).toContain('No se pudo conectar con el servidor.');
  });
});

describe('aFilaBitacora', () => {
  it('prepara la fila con la severidad de la etiqueta', () => {
    expect(aFilaBitacora(REGISTROS[1]).severidad).toBe('danger');
    expect(aFilaBitacora(REGISTROS[0]).severidad).toBe('success');
    expect(aFilaBitacora(REGISTROS[0]).idUsuario).toBe(ID_CLIENTE);
  });
});
