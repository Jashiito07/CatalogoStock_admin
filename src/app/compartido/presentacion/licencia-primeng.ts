/** Devuelve la licencia solo si no está vacía; si no, undefined (PrimeNG muestra su aviso). */
export function licenciaPrimeng(valor: string): string | undefined {
  return valor.trim() || undefined;
}
