import { ConsultaBitacora, PaginaBitacora } from '../dominio/bitacora';

/** Puerto de lectura de la bitácora (`GET /auditoria`, solo Vendedor, RF-USU-04). */
export abstract class LectorBitacora {
  abstract consultar(consulta: ConsultaBitacora): Promise<PaginaBitacora>;
}
