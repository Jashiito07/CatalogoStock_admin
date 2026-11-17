import {
  CodigoRecuperacion,
  ConsultaClientes,
  EstadoClienteActualizado,
  PaginaClientes,
} from '../dominio/cliente';

/**
 * Puerto hacia la API de clientes (contrato recuperacion-clave.md, solo Vendedor).
 * Los errores llegan como `ErrorApi` (compartido/aplicacion/error-api.ts).
 */
export abstract class ApiClientes {
  /** GET /usuarios: clientes paginados, con búsqueda opcional. */
  abstract listar(consulta: ConsultaClientes): Promise<PaginaClientes>;

  /**
   * Cuántos clientes tienen el correo sin verificar: `total` de
   * `GET /usuarios?correoVerificado=false&tamanio=1` (contrato usuarios-gestion.md).
   */
  abstract contarSinCorreoVerificado(): Promise<number>;

  /** POST /usuarios/{id}/codigo-recuperacion: genera un código e invalida el anterior. */
  abstract generarCodigoRecuperacion(idCliente: string): Promise<CodigoRecuperacion>;

  /**
   * PATCH /usuarios/{id}/estado (D-53, contrato usuarios-gestion.md): desactiva o reactiva
   * la cuenta. Desactivar cierra sus sesiones; sus pedidos se conservan. No hay borrado.
   */
  abstract cambiarEstado(idCliente: string, activo: boolean): Promise<EstadoClienteActualizado>;
}

/** Copia texto al portapapeles del dispositivo. Falla si el navegador no lo permite. */
export abstract class Portapapeles {
  abstract copiar(texto: string): Promise<void>;
}
