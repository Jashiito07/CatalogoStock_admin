import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { Mock } from 'vitest';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import {
  MENSAJE_CLIENTE_NO_ENCONTRADO,
  MENSAJE_NO_SE_PUEDE_DESACTIVAR_VENDEDOR,
  MENSAJE_CUENTA_INACTIVA,
  MENSAJE_SIN_PERMISO,
  mensajeDeErrorAlGenerarCodigo,
} from '../../aplicacion/mensajes-clientes';
import { ApiClientes, Portapapeles } from '../../aplicacion/puertos';
import {
  Cliente,
  CodigoRecuperacion,
  ConsultaClientes,
  EstadoClienteActualizado,
  PaginaClientes,
} from '../../dominio/cliente';
import {
  aFilaCliente,
  Clientes,
  MENSAJE_NO_SE_DESACTIVO,
  MENSAJE_NO_SE_GENERO,
  MENSAJE_NO_SE_REACTIVO,
  RETARDO_BUSQUEDA_MS,
} from './clientes';

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
  let cambiarEstado: Mock<(id: string, activo: boolean) => Promise<EstadoClienteActualizado>>;
  let contarSinVerificar: Mock<() => Promise<number>>;
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
    cambiarEstado = vi.fn().mockResolvedValue({ id: ID_MARIA, activo: false });
    contarSinVerificar = vi.fn().mockResolvedValue(0);
    await TestBed.configureTestingModule({
      imports: [Clientes],
      providers: [
        MessageService,
        {
          provide: ApiClientes,
          useValue: {
            listar,
            generarCodigoRecuperacion: generar,
            cambiarEstado,
            contarSinCorreoVerificado: contarSinVerificar,
          },
        },
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
    expect(filas()[1]?.textContent).toContain('No disponible');
  });

  it('D-53: la columna «Estado» muestra Activo o Desactivado con p-tag', () => {
    const estados = filas().map((fila) =>
      fila.querySelector('[data-prueba="estado-cuenta"] p-tag')?.textContent?.trim(),
    );
    expect(estados).toEqual(['Activo', 'Desactivado']);
  });

  it('una cuenta desactivada no ofrece generar código (CUENTA_INACTIVA) y no hay «Eliminar»', () => {
    const [activa, desactivada] = filas();
    expect(activa?.querySelector('[data-prueba="generar-codigo"]')).not.toBeNull();
    expect(desactivada?.querySelector('[data-prueba="generar-codigo"]')).toBeNull();
    expect(elemento.textContent).not.toContain('Eliminar');
  });

  it('D-53: cada cuenta ofrece la acción contraria a su estado', () => {
    const [activa, desactivada] = filas();
    expect(activa?.querySelector('[data-prueba="desactivar"]')).not.toBeNull();
    expect(activa?.querySelector('[data-prueba="reactivar"]')).toBeNull();
    expect(desactivada?.querySelector('[data-prueba="reactivar"]')).not.toBeNull();
    expect(desactivada?.querySelector('[data-prueba="desactivar"]')).toBeNull();
  });

  it.each([
    ['activos', true],
    ['desactivados', false],
  ] as const)('D-53: el filtro «%s» consulta con ?activo=%s y vuelve a la página 1', async (filtro, activo) => {
    componente()['alCargarPagina']({ first: 40, rows: 20 });
    await estable();
    componente()['filtroEstado'].setValue(filtro);
    await estable();
    expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20, activo });
  });

  it('CA-11: un filtro sin resultados ofrece «Limpiar filtros» y vuelve a todos', async () => {
    listar.mockResolvedValue(pagina([]));
    componente()['filtroEstado'].setValue('desactivados');
    await estable();
    const vacio = elemento.querySelector('[data-prueba="clientes-vacio"]');
    expect(vacio?.textContent).toContain('No hay clientes con ese estado.');

    vacio?.querySelector('button')?.click();
    await estable();
    expect(componente()['filtroEstado'].value).toBe('todos');
    expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20 });
  });

  const botonDe = (indice: number, accion: string) =>
    filas()[indice]?.querySelector<HTMLButtonElement>(`[data-prueba="${accion}"] button`);
  const botonConfirmacion = (texto: string) =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('.p-confirmdialog button')).find(
      (boton) => boton.textContent?.includes(texto),
    );

  it('D-53: desactivar pide confirmación con el texto del contrato y no cambia nada si se cancela', async () => {
    botonDe(0, 'desactivar')?.click();
    await estable();
    expect(document.body.textContent).toContain(
      'El cliente no podrá ingresar a la app. Sus pedidos se conservan.',
    );
    botonConfirmacion('Cancelar')?.click();
    await estable();
    expect(cambiarEstado).not.toHaveBeenCalled();
  });

  it('D-53: al confirmar desactiva (activo=false), avisa con un toast y recarga la lista', async () => {
    const agregar = vi.spyOn(avisos, 'add');
    botonDe(0, 'desactivar')?.click();
    await estable();
    botonConfirmacion('Desactivar')?.click();
    await estable();

    expect(cambiarEstado).toHaveBeenCalledWith(ID_MARIA, false);
    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Cuenta desactivada' }),
    );
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('D-53: reactivar es directo (sin confirmación), con toast, y recarga la lista', async () => {
    const agregar = vi.spyOn(avisos, 'add');
    botonDe(1, 'reactivar')?.click();
    await estable();

    expect(document.body.querySelector('.p-confirmdialog')).toBeNull();
    expect(cambiarEstado).toHaveBeenCalledWith('b', true);
    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Cuenta reactivada' }),
    );
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it.each([
    [new ErrorApi('NO_AUTORIZADO', 'No tiene permiso.', 403), MENSAJE_SIN_PERMISO],
    [new ErrorApi('USUARIO_NO_ENCONTRADO', 'No existe.', 404), MENSAJE_CLIENTE_NO_ENCONTRADO],
    [
      new ErrorApi('OPERACION_NO_PERMITIDA', 'No permitida.', 422),
      MENSAJE_NO_SE_PUEDE_DESACTIVAR_VENDEDOR,
    ],
  ])('D-53: un error al desactivar (%s) se avisa con un mensaje claro', async (error, mensaje) => {
    cambiarEstado.mockRejectedValue(error);
    const agregar = vi.spyOn(avisos, 'add');

    await componente().cambiarEstado(aFilaCliente(cliente(), new Date()), false);
    await estable();

    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: MENSAJE_NO_SE_DESACTIVO,
        detail: mensaje,
      }),
    );
  });

  it('D-53: un 404 al cambiar el estado actualiza la lista; un 403 no', async () => {
    cambiarEstado.mockRejectedValueOnce(new ErrorApi('USUARIO_NO_ENCONTRADO', 'x', 404));
    await componente().cambiarEstado(aFilaCliente(cliente(), new Date()), false);
    await estable();
    expect(listar).toHaveBeenCalledTimes(2);

    cambiarEstado.mockRejectedValueOnce(new ErrorApi('NO_AUTORIZADO', 'x', 403));
    await componente().cambiarEstado(aFilaCliente(cliente(), new Date()), false);
    await estable();
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('D-53: un error de red al reactivar muestra el mensaje de la API sin detalles técnicos', async () => {
    cambiarEstado.mockRejectedValue(new ErrorApi('SIN_CONEXION', 'No se pudo conectar con el servidor.', 0));
    const agregar = vi.spyOn(avisos, 'add');
    await componente().cambiarEstado(aFilaCliente(cliente({ activo: false }), new Date()), true);
    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ summary: MENSAJE_NO_SE_REACTIVO, detail: 'No se pudo conectar con el servidor.' }),
    );
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

  describe('Correo verificado (contrato usuarios-gestion, RF-USU-05)', () => {
    const celdaCorreo = (indice: number) => filas()[indice]?.querySelector('.cs-clientes__correo');
    const aviso = () => elemento.querySelector('[data-prueba="aviso-sin-verificar"]');

    async function recargarCon(elementos: Cliente[], sinVerificar = 0): Promise<void> {
      listar.mockResolvedValue(pagina(elementos));
      contarSinVerificar.mockResolvedValue(sinVerificar);
      await componente().cargar();
      await estable();
    }

    it('muestra «Verificado» (success) o «Sin verificar» (warn) según correoVerificadoEn', async () => {
      await recargarCon([
        cliente({ correoVerificadoEn: '2026-11-10T12:00:00Z' }),
        cliente({ id: 'b', correoVerificadoEn: null }),
      ]);
      const verificado = celdaCorreo(0)?.querySelector('[data-prueba="correo-verificado"]');
      expect(verificado?.textContent?.trim()).toBe('Verificado');
      expect(verificado?.matches('.p-tag-success, :has(.p-tag-success)')).toBe(true);
      const sin = celdaCorreo(1)?.querySelector('[data-prueba="correo-sin-verificar"]');
      expect(sin?.textContent).toContain('Sin verificar');
      expect(sin?.matches('.p-tag-warn, :has(.p-tag-warn)')).toBe(true);
    });

    it('la etiqueta «Sin verificar» es enfocable y lleva la ayuda para lectores de pantalla', async () => {
      await recargarCon([cliente({ correoVerificadoEn: null })]);
      const sin = celdaCorreo(0)?.querySelector('[data-prueba="correo-sin-verificar"]');
      expect(sin?.getAttribute('tabindex')).toBe('0');
      const idAyuda = sin?.getAttribute('aria-describedby') ?? '';
      expect(celdaCorreo(0)?.querySelector(`[id="${idAyuda}"]`)?.textContent).toContain(
        'Aún no confirmó su correo. No podrá recuperar su clave por correo; solo con tu ayuda.',
      );
    });

    it('API antigua: sin el campo no hay etiqueta (ni «Sin verificar» falso)', async () => {
      await recargarCon([cliente()]);
      expect(celdaCorreo(0)?.textContent).toContain('maria.zambrano@correo.com');
      expect(celdaCorreo(0)?.querySelector('p-tag')).toBeNull();
      expect(elemento.textContent).not.toContain('Sin verificar');
    });

    it.each([
      ['verificados', true],
      ['sin-verificar', false],
    ] as const)('el filtro «%s» consulta con ?correoVerificado=%s y vuelve a la página 1', async (filtro, valor) => {
      componente()['alCargarPagina']({ first: 40, rows: 20 });
      await estable();
      componente()['filtroCorreo'].setValue(filtro);
      await estable();
      expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20, correoVerificado: valor });
    });

    it('el filtro de correo se combina con el de estado y la búsqueda', async () => {
      componente()['busquedaAplicada'].set('ana');
      componente()['filtroEstado'].setValue('activos');
      await estable();
      componente()['filtroCorreo'].setValue('sin-verificar');
      await estable();
      expect(ultimaConsulta()).toEqual({
        pagina: 1,
        tamanio: 20,
        busqueda: 'ana',
        activo: true,
        correoVerificado: false,
      });
    });

    it('«Todos» no envía el parámetro', async () => {
      componente()['filtroCorreo'].setValue('sin-verificar');
      await estable();
      componente()['filtroCorreo'].setValue('todos');
      await estable();
      expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20 });
    });

    it('CA-11: sin resultados con el filtro de correo ofrece «Limpiar filtros» y restablece ambos', async () => {
      listar.mockResolvedValue(pagina([]));
      componente()['filtroCorreo'].setValue('sin-verificar');
      await estable();
      const vacio = elemento.querySelector('[data-prueba="clientes-vacio"]');
      expect(vacio?.textContent).toContain('No hay clientes con ese estado de correo.');
      vacio?.querySelector('button')?.click();
      await estable();
      expect(componente()['filtroCorreo'].value).toBe('todos');
      expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20 });
    });

    it('el aviso muestra «N clientes tienen el correo sin verificar» con el total del servidor', async () => {
      await recargarCon([cliente({ correoVerificadoEn: null })], 3);
      expect(aviso()?.textContent).toContain('3 clientes tienen el correo sin verificar');
      expect(aviso()?.matches('.p-message-warn, :has(.p-message-warn)')).toBe(true);
    });

    it('el aviso usa el singular con 1 cliente', async () => {
      await recargarCon([cliente({ correoVerificadoEn: null })], 1);
      expect(aviso()?.textContent).toContain('1 cliente tiene el correo sin verificar');
    });

    it('el aviso se oculta si no hay clientes sin verificar', async () => {
      await recargarCon([cliente({ correoVerificadoEn: '2026-11-10T12:00:00Z' })], 0);
      expect(aviso()).toBeNull();
    });

    it('si falla la consulta del aviso, se oculta y la tabla sigue funcionando', async () => {
      await recargarCon([cliente()], 2);
      expect(aviso()).not.toBeNull();
      contarSinVerificar.mockRejectedValue(new ErrorApi('SIN_CONEXION', 'No se pudo conectar.', 0));
      await componente().cargar();
      await estable();
      expect(aviso()).toBeNull();
      expect(filas()).toHaveLength(1);
      expect(elemento.querySelector('p-message[severity="error"]')).toBeNull();
    });

    it('el aviso se actualiza tras un cambio (reactivar) con el total oficial', async () => {
      await recargarCon([cliente({ activo: false })], 2);
      contarSinVerificar.mockResolvedValue(1);
      botonDe(0, 'reactivar')?.click();
      await estable();
      expect(aviso()?.textContent).toContain('1 cliente tiene el correo sin verificar');
    });

    it('«Ver solo estos» aplica el filtro Sin verificar y desaparece del aviso', async () => {
      await recargarCon([cliente({ correoVerificadoEn: null })], 2);
      elemento.querySelector<HTMLButtonElement>('[data-prueba="ver-sin-verificar"] button')?.click();
      await estable();
      expect(componente()['filtroCorreo'].value).toBe('sin-verificar');
      expect(ultimaConsulta()).toEqual({ pagina: 1, tamanio: 20, correoVerificado: false });
      expect(elemento.querySelector('[data-prueba="ver-sin-verificar"]')).toBeNull();
    });

    it('aFilaCliente: estado del correo verificado, sin verificar o desconocido', () => {
      const ahora = new Date();
      expect(aFilaCliente(cliente({ correoVerificadoEn: '2026-11-10T12:00:00Z' }), ahora).estadoCorreo).toBe('verificado');
      expect(aFilaCliente(cliente({ correoVerificadoEn: null }), ahora).estadoCorreo).toBe('sin-verificar');
      expect(aFilaCliente(cliente(), ahora).estadoCorreo).toBe('desconocido');
    });
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
