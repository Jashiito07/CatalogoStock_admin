import { CodigoRecuperacion, ConsultaClientes, PaginaClientes } from '../dominio/cliente';

/**
 * Puerto hacia la API de clientes (contrato recuperacion-clave.md, solo Vendedor).
 * Los errores llegan como `ErrorApi` (compartido/aplicacion/error-api.ts).
 */
export abstract class ApiClientes {
  /** GET /usuarios: clientes paginados, con búsqueda opcional. */
  abstract listar(consulta: ConsultaClientes): Promise<PaginaClientes>;

  /** POST /usuarios/{id}/codigo-recuperacion: genera un código e invalida el anterior. */
  abstract generarCodigoRecuperacion(idCliente: string): Promise<CodigoRecuperacion>;
}

/** Copia texto al portapapeles del dispositivo. Falla si el navegador no lo permite. */
export abstract class Portapapeles {
  abstract copiar(texto: string): Promise<void>;
}
