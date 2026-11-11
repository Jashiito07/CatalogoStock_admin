import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { Mock } from 'vitest';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import {
  MENSAJE_CLIENTE_NO_ENCONTRADO,
  MENSAJE_CUENTA_INACTIVA,
  MENSAJE_SIN_PERMISO,
  mensajeDeErrorAlGenerarCodigo,
} from '../../aplicacion/mensajes-clientes';
import { ApiClientes, Portapapeles } from '../../aplicacion/puertos';
import {
  Cliente,
  CodigoRecuperacion,
  ConsultaClientes,
  PaginaClientes,
} from '../../dominio/cliente';
import { aFilaCliente, Clientes, MENSAJE_NO_SE_GENERO, RETARDO_BUSQUEDA_MS } from './clientes';

const ID_MARIA = '6f1c0000-0000-4000-8000-000000000001';

function cliente(parcial: Partial<Cliente> = {}): Cliente {
  return {
    id: ID_MARIA,
    nombre: 'María Zambrano',
    correo: 'maria.zambrano@correo.com',
    telefono: '+593991234567',
    activo: true,
    creadoEn: '2026-11-05T15:15:00Z',
    codigoRecuperacionVigenteHasta: null,
    ...parcial,
  };
}

function pagina(elementos: Cliente[], total = elementos.length): PaginaClientes {
  return { elementos, pagina: 1, tamanio: 20, total };
}

const CODIGO: CodigoRecuperacion = {
  codigo: '482913',
  venceEn: '2099-11-09T15:30:00Z',
  cliente: { id: ID_MARIA, nombre: 'María Zambrano', correo: 'maria.zambrano@correo.com' },
};

describe('Clientes (RF-USU-05)', () => {
  let listar: Mock<(consulta: ConsultaClientes) => Promise<PaginaClientes>>;
  let generar: Mock<(id: string) => Promise<CodigoRecuperacion>>;
  let fixture: ComponentFixture<Clientes>;
  let elemento: HTMLElement;
  let avisos: MessageService;

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    listar = vi.fn().mockResolvedValue(
      pagina(
        [
          cliente(),
          cliente({
            id: 'b',
            nombre: 'Luis Vera',
            activo: false,
            telefono: '+593987654321',
          }),
        ],
        41,
      ),
    );
    generar = vi.fn().mockResolvedValue(CODIGO);
    await TestBed.configureTestingModule({
      imports: [Clientes],
      providers: [
        MessageService,
        { provide: ApiClientes, useValue: { listar, generarCodigoRecuperacion: generar } },
        { provide: Portapapeles, useValue: { copiar: vi.fn().mockResolvedValue(undefined) } },
      ],
    }).compileComponents();
    avisos = TestBed.inject(MessageService);
    fixture = TestBed.createComponent(Clientes);
    elemento = fixture.nativeElement as HTMLElement;
    await estable();
  });

  afterEach(() => fixture.destroy());

  const componente = () => fixture.componentInstance;
  const ultimaConsulta = () => listar.mock.calls.at(-1)?.[0];
  const filas = () => Array.from(elemento.querySelectorAll('[data-prueba="fila-cliente"]'));
  const botonAceptarConfirmacion = () =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('.p-confirmdialog button')).find(
      (boton) => boton.textContent?.includes('Generar código'),
    );

  it('carga la primera página al abrir (pagina 1, tamanio 20)', () => {
    expect(listar).toHaveBeenCalledTimes(1);
    expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20 });
    expect(elemento.textContent).toContain('1 a 20 de 41 clientes');
  });

  it('muestra nombre, correo, teléfono legible, fecha de registro y estado del código', () => {
    const texto = filas()[0]?.textContent ?? '';
    expect(texto).toContain('María Zambrano');
    expect(texto).toContain('maria.zambrano@correo.com');
    expect(texto).toContain('099 123 4567');
    expect(texto).toContain('05/11/2026');
    expect(texto).toContain('Sin código vigente');
    expect(filas()[1]?.textContent).toContain('Cuenta inactiva');
  });

  it('un cliente inactivo no permite generar código', () => {
    const botones = filas().map((fila) =>
      fila.querySelector<HTMLButtonElement>('[data-prueba="generar-codigo"] button'),
    );
    expect(botones[0]?.disabled).toBe(false);
    expect(botones[1]?.disabled).toBe(true);
  });

  it('pagina en el servidor: la página 3 de 20 pide pagina=3', async () => {
    componente()['alCargarPagina']({ first: 40, rows: 20 });
    await estable();
    expect(ultimaConsulta()).toEqual({ pagina: 3, tamanio: 20 });
  });

  it('busca con retardo y vuelve a la página 1', async () => {
    vi.useFakeTimers();
    try {
      componente()['alCargarPagina']({ first: 40, rows: 20 });
      await Promise.resolve();
      const llamadas = listar.mock.calls.length;
      componente()['busqueda'].setValue('mar');
      componente()['busqueda'].setValue('  maría ');
      vi.advanceTimersByTime(RETARDO_BUSQUEDA_MS - 1);
      expect(listar.mock.calls.length).toBe(llamadas);
      vi.advanceTimersByTime(1);
      expect(listar.mock.calls.length).toBe(llamadas + 1);
      expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20, busqueda: 'maría' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('CA-11: sin resultados de la búsqueda ofrece «Limpiar búsqueda»', async () => {
    listar.mockResolvedValue(pagina([]));
    componente()['busquedaAplicada'].set('nadie');
    await componente().cargar();
    await estable();

    const vacio = elemento.querySelector('[data-prueba="clientes-vacio"]');
    expect(vacio?.textContent).toContain('No hay clientes que coincidan con «nadie».');
    vacio?.querySelector('button')?.click();
    await estable();
    expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20 });
  });

  it('pide confirmación antes de generar y no genera si se cancela', async () => {
    filas()[0]?.querySelector<HTMLButtonElement>('[data-prueba="generar-codigo"] button')?.click();
    await estable();

    expect(document.body.textContent).toContain(
      '¿Generar un código para María Zambrano? El anterior dejará de servir.',
    );
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('.p-confirmdialog button'))
      .find((boton) => boton.textContent?.includes('Cancelar'))
      ?.click();
    await estable();
    expect(generar).not.toHaveBeenCalled();
  });

  it('al confirmar genera el código, lo muestra una vez y lo descarta al cerrar', async () => {
    filas()[0]?.querySelector<HTMLButtonElement>('[data-prueba="generar-codigo"] button')?.click();
    await estable();
    botonAceptarConfirmacion()?.click();
    await estable();

    expect(generar).toHaveBeenCalledWith(ID_MARIA);
    expect(
      document.body.querySelector('[data-prueba="codigo"]')?.textContent?.trim(),
    ).toBe('482913');
    // Se vuelve a consultar la lista para mostrar el estado del servidor.
    expect(listar).toHaveBeenCalledTimes(2);

    componente()['descartarCodigo']();
    await estable();
    expect(componente()['codigoGenerado']()).toBeNull();
    expect(document.body.querySelector('[data-prueba="codigo"]')).toBeNull();
  });

  it.each([
    [new ErrorApi('NO_ENCONTRADO', 'No encontrado.', 404), MENSAJE_CLIENTE_NO_ENCONTRADO],
    [new ErrorApi('CUENTA_INACTIVA', 'Inactiva.', 422), MENSAJE_CUENTA_INACTIVA],
    [new ErrorApi('NO_AUTORIZADO', 'No tiene permiso.', 403), MENSAJE_SIN_PERMISO],
  ])('un error al generar (%s) se avisa con un mensaje claro', async (error, mensaje) => {
    generar.mockRejectedValue(error);
    const agregar = vi.spyOn(avisos, 'add');

    await componente().generarCodigo(aFilaCliente(cliente(), new Date()));
    await estable();

    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: MENSAJE_NO_SE_GENERO, detail: mensaje }),
    );
    expect(componente()['codigoGenerado']()).toBeNull();
  });

  it('CA-02: un 403 al listar muestra «No tienes permiso» y permite reintentar', async () => {
    listar.mockRejectedValue(new ErrorApi('NO_AUTORIZADO', 'No tiene permiso.', 403));
    await componente().cargar();
    await estable();
    expect(elemento.textContent).toContain(MENSAJE_SIN_PERMISO);

    listar.mockResolvedValue(pagina([cliente()]));
    Array.from(elemento.querySelectorAll('button'))
      .find((boton) => boton.textContent?.includes('Reintentar'))
      ?.click();
    await estable();
    expect(filas()).toHaveLength(1);
  });
});

describe('aFilaCliente', () => {
  const ahora = new Date('2026-11-09T15:00:00Z');

  it('con un código vigente muestra la hora de vencimiento en hora de Ecuador', () => {
    const fila = aFilaCliente(cliente({ codigoRecuperacionVigenteHasta: '2026-11-09T15:12:00Z' }), ahora);
    expect(fila.estadoCodigo).toEqual({ tipo: 'vigente', hasta: '10:12' });
  });

  it('un código ya vencido no se muestra como vigente', () => {
    const fila = aFilaCliente(cliente({ codigoRecuperacionVigenteHasta: '2026-11-09T14:00:00Z' }), ahora);
    expect(fila.estadoCodigo).toEqual({ tipo: 'ninguno' });
  });

  it('una cuenta inactiva se marca como tal', () => {
    expect(aFilaCliente(cliente({ activo: false }), ahora).estadoCodigo).toEqual({ tipo: 'inactiva' });
  });
});

describe('mensajeDeErrorAlGenerarCodigo', () => {
  it('un error desconocido no muestra detalles técnicos', () => {
    expect(mensajeDeErrorAlGenerarCodigo(new Error('x'))).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo.',
    );
  });
});
