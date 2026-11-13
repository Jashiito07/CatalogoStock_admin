import { CambiosMarca, Marca, MarcaSugerida, NuevaMarca } from '../dominio/marca';

/**
 * Puerto hacia la API de marcas (docs/contrato-api/productos.md, «Endpoints: marcas»).
 * Los errores llegan como `ErrorApi` (compartido/aplicacion/error-api.ts). No hay `DELETE`:
 * una marca se desactiva.
 */
export abstract class ApiMarcas {
  /** GET /marcas: ordenadas por `orden` y nombre; con `incluirInactivas` (solo Vendedor). */
  abstract listar(incluirInactivas: boolean): Promise<readonly Marca[]>;

  /** GET /marcas/sugeridas: lista fija de «Configura tu negocio» (D-48). */
  abstract sugeridas(): Promise<readonly MarcaSugerida[]>;

  /** POST /marcas. 409 `MARCA_DUPLICADA`, 400 `DATOS_INVALIDOS`. */
  abstract crear(marca: NuevaMarca): Promise<Marca>;

  /** PATCH /marcas/{id}: cuerpo parcial. */
  abstract actualizar(id: string, cambios: CambiosMarca): Promise<Marca>;
}
