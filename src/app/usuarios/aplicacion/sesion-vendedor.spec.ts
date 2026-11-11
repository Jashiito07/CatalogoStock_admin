import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { MENSAJE_CREDENCIALES_INVALIDAS } from '../dominio/usuario';
import {
  AlmacenEnMemoria,
  ApiAutenticacionFalsa,
  crearApiFalsa,
  crearSesion,
  errorCredenciales,
  errorSinConexion,
  errorTokenInvalido,
} from '../pruebas/dobles-sesion';
import { AlmacenTokenRenovacion, ApiAutenticacion } from './puertos';
import { SesionVendedor } from './sesion-vendedor';

describe('SesionVendedor', () => {
  let api: ApiAutenticacionFalsa;
  let almacen: AlmacenEnMemoria;
  let sesion: SesionVendedor;

  beforeEach(() => {
    api = crearApiFalsa();
    almacen = new AlmacenEnMemoria();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: almacen },
      ],
    });
    sesion = TestBed.inject(SesionVendedor);
  });

  describe('ingresar (RF-USU-01, D-19)', () => {
    it('CA-01: guarda el token de acceso solo en memoria y el de renovación en el almacén', async () => {
      const respuesta = crearSesion('VENDEDOR');
      api.ingresarVendedor.mockResolvedValue(respuesta);

      await sesion.ingresar('  vendedora@correo.com ', 'Clave2026');

      expect(api.ingresarVendedor).toHaveBeenCalledWith('vendedora@correo.com', 'Clave2026');
      expect(sesion.obtenerTokenAcceso()).toBe(respuesta.tokenAcceso);
      expect(almacen.valor).toBe(respuesta.tokenRenovacion);
      expect(almacen.valor).not.toBe(respuesta.tokenAcceso);
      expect(sesion.usuario()?.nombre).toBe('Rosa Vendedora');
      expect(sesion.activa()).toBe(true);
    });

    it('RF-USU-03: un Cliente rechazado por la API no obtiene sesión', async () => {
      api.ingresarVendedor.mockRejectedValue(errorCredenciales());

      await expect(sesion.ingresar('cliente@correo.com', 'Clave2026')).rejects.toMatchObject({
        codigo: 'CREDENCIALES_INVALIDAS',
      });
      expect(sesion.activa()).toBe(false);
      expect(sesion.obtenerTokenAcceso()).toBeNull();
      expect(almacen.valor).toBeNull();
    });

    it('RF-USU-03 (defensa adicional): si llegara una sesión de Cliente, la revoca y responde el mensaje genérico', async () => {
      const ajena = crearSesion('CLIENTE');
      api.ingresarVendedor.mockResolvedValue(ajena);

      const error = await sesion.ingresar('cliente@correo.com', 'Clave2026').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ErrorApi);
      expect((error as ErrorApi).mensaje).toBe(MENSAJE_CREDENCIALES_INVALIDAS);
      expect(api.salir).toHaveBeenCalledWith(ajena.tokenRenovacion);
      expect(sesion.activa()).toBe(false);
      expect(sesion.obtenerTokenAcceso()).toBeNull();
      expect(almacen.valor).toBeNull();
    });
  });

  describe('renovar (D-09, rotación)', () => {
    beforeEach(async () => {
      api.ingresarVendedor.mockResolvedValue(crearSesion());
      await sesion.ingresar('vendedora@correo.com', 'Clave2026');
    });

    it('envía el token guardado y guarda el par nuevo', async () => {
      const anterior = almacen.valor;
      const nueva = crearSesion();
      api.renovar.mockResolvedValue(nueva);

      await expect(sesion.renovar()).resolves.toBe(nueva.tokenAcceso);

      expect(api.renovar).toHaveBeenCalledWith(anterior);
      expect(sesion.obtenerTokenAcceso()).toBe(nueva.tokenAcceso);
      expect(almacen.valor).toBe(nueva.tokenRenovacion);
    });

    it('varias llamadas simultáneas comparten una sola renovación', async () => {
      const nueva = crearSesion();
      api.renovar.mockResolvedValue(nueva);

      const tokens = await Promise.all([sesion.renovar(), sesion.renovar(), sesion.renovar()]);

      expect(api.renovar).toHaveBeenCalledTimes(1);
      expect(tokens).toEqual([nueva.tokenAcceso, nueva.tokenAcceso, nueva.tokenAcceso]);
    });

    it('TOKEN_INVALIDO descarta la sesión local', async () => {
      api.renovar.mockRejectedValue(errorTokenInvalido());

      await expect(sesion.renovar()).rejects.toMatchObject({ codigo: 'TOKEN_INVALIDO' });

      expect(sesion.activa()).toBe(false);
      expect(sesion.obtenerTokenAcceso()).toBeNull();
      expect(almacen.valor).toBeNull();
    });

    it('sin conexión conserva el token de renovación para reintentar', async () => {
      const guardado = almacen.valor;
      api.renovar.mockRejectedValue(errorSinConexion());

      await expect(sesion.renovar()).rejects.toMatchObject({ codigo: 'SIN_CONEXION' });

      expect(almacen.valor).toBe(guardado);
      expect(sesion.activa()).toBe(true);
    });
  });

  describe('asegurarSesion (recarga de la página)', () => {
    it('sin token de renovación no hay sesión y no llama a la API', async () => {
      await expect(sesion.asegurarSesion()).resolves.toBe('sin-sesion');
      expect(api.renovar).not.toHaveBeenCalled();
    });

    it('recupera la sesión con el token de renovación de sessionStorage', async () => {
      almacen.valor = 'renovacion-guardada';
      api.renovar.mockResolvedValue(crearSesion());

      await expect(sesion.asegurarSesion()).resolves.toBe('activa');
      expect(api.renovar).toHaveBeenCalledWith('renovacion-guardada');
      expect(sesion.activa()).toBe(true);
    });

    it('informa sin conexión cuando la API no responde', async () => {
      almacen.valor = 'renovacion-guardada';
      api.renovar.mockRejectedValue(errorSinConexion());

      await expect(sesion.asegurarSesion()).resolves.toBe('sin-conexion');
    });

    it('no acepta una sesión renovada de un Cliente', async () => {
      almacen.valor = 'renovacion-guardada';
      api.renovar.mockResolvedValue(crearSesion('CLIENTE'));

      await expect(sesion.asegurarSesion()).resolves.toBe('sin-sesion');
      expect(sesion.activa()).toBe(false);
      expect(almacen.valor).toBeNull();
    });
  });

  describe('cerrarSesion', () => {
    it('revoca en la API y borra la sesión local', async () => {
      const inicial = crearSesion();
      api.ingresarVendedor.mockResolvedValue(inicial);
      await sesion.ingresar('vendedora@correo.com', 'Clave2026');

      await sesion.cerrarSesion();

      expect(api.salir).toHaveBeenCalledWith(inicial.tokenRenovacion);
      expect(sesion.activa()).toBe(false);
      expect(sesion.obtenerTokenAcceso()).toBeNull();
      expect(almacen.valor).toBeNull();
    });

    it('borra la sesión local aunque la API no responda', async () => {
      api.ingresarVendedor.mockResolvedValue(crearSesion());
      await sesion.ingresar('vendedora@correo.com', 'Clave2026');
      api.salir.mockRejectedValue(errorSinConexion());

      await sesion.cerrarSesion();

      expect(sesion.activa()).toBe(false);
      expect(almacen.valor).toBeNull();
    });
  });

  describe('cambiarClave (RF-USU-05)', () => {
    it('envía el token de renovación actual para conservar esta sesión y no la cierra', async () => {
      const respuesta = crearSesion();
      api.ingresarVendedor.mockResolvedValue(respuesta);
      await sesion.ingresar('vendedora@correo.com', 'Clave2026');

      await sesion.cambiarClave('Clave2026', 'NuevaClave2026');

      expect(api.cambiarClave).toHaveBeenCalledWith({
        claveActual: 'Clave2026',
        claveNueva: 'NuevaClave2026',
        tokenRenovacionActual: respuesta.tokenRenovacion,
      });
      expect(sesion.activa()).toBe(true);
      expect(almacen.valor).toBe(respuesta.tokenRenovacion);
    });

    it('espera una renovación en curso y envía el token ya rotado', async () => {
      api.ingresarVendedor.mockResolvedValue(crearSesion());
      await sesion.ingresar('vendedora@correo.com', 'Clave2026');
      const rotada = crearSesion();
      let terminarRenovacion: (s: typeof rotada) => void = () => undefined;
      api.renovar.mockReturnValue(new Promise((resolver) => (terminarRenovacion = resolver)));

      const renovacion = sesion.renovar();
      const cambio = sesion.cambiarClave('Clave2026', 'NuevaClave2026');
      terminarRenovacion(rotada);
      await renovacion;
      await cambio;

      expect(api.cambiarClave.mock.calls[0]?.[0].tokenRenovacionActual).toBe(rotada.tokenRenovacion);
    });

    it('propaga CLAVE_ACTUAL_INCORRECTA sin tocar la sesión', async () => {
      api.ingresarVendedor.mockResolvedValue(crearSesion());
      await sesion.ingresar('vendedora@correo.com', 'Clave2026');
      api.cambiarClave.mockRejectedValue(
        new ErrorApi('CLAVE_ACTUAL_INCORRECTA', 'La clave actual no es correcta.', 422),
      );

      await expect(sesion.cambiarClave('Otra2026', 'NuevaClave2026')).rejects.toMatchObject({
        codigo: 'CLAVE_ACTUAL_INCORRECTA',
      });
      expect(sesion.activa()).toBe(true);
    });
  });
});
