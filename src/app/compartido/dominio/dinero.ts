/**
 * Dinero exacto en centavos de dólar (USD).
 *
 * Nunca se suman números de punto flotante: todos los cálculos se hacen con
 * enteros de centavos. Los montos llegan de la API como texto decimal («12.50»)
 * y se devuelven en el mismo formato (docs/contrato-api/README.md).
 *
 * Capa de dominio: sin dependencias de frameworks. Misma forma que en la app móvil.
 */
const PATRON_TEXTO_DECIMAL = /^(\d+)(?:\.(\d{1,2}))?$/;

const FORMATO_MONEDA = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export class ErrorDinero extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDinero';
  }
}

export class Dinero {
  private constructor(readonly centavos: number) {}

  static cero(): Dinero {
    return new Dinero(0);
  }

  static desdeCentavos(centavos: number): Dinero {
    if (!Number.isSafeInteger(centavos) || centavos < 0) {
      throw new ErrorDinero(`Cantidad de centavos inválida: ${centavos}`);
    }
    return new Dinero(centavos);
  }

  /** Convierte un texto decimal como «12.50», «12.5» o «12» en dinero exacto. */
  static desdeTexto(texto: string): Dinero {
    const coincidencia = PATRON_TEXTO_DECIMAL.exec(texto.trim());
    if (!coincidencia) {
      throw new ErrorDinero(`Monto inválido: «${texto}»`);
    }
    const [, enteros, decimales = ''] = coincidencia;
    const centavos = Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
    return Dinero.desdeCentavos(centavos);
  }

  /** Indica si un texto es un monto válido, sin lanzar errores (útil en formularios). */
  static esTextoValido(texto: string): boolean {
    try {
      Dinero.desdeTexto(texto);
      return true;
    } catch {
      return false;
    }
  }

  /** Suma una lista de montos de forma exacta. */
  static total(montos: readonly Dinero[]): Dinero {
    return montos.reduce((acumulado, monto) => acumulado.sumar(monto), Dinero.cero());
  }

  sumar(otro: Dinero): Dinero {
    return Dinero.desdeCentavos(this.centavos + otro.centavos);
  }

  /** Multiplica por una cantidad entera no negativa (por ejemplo, unidades de un producto). */
  multiplicar(cantidad: number): Dinero {
    if (!Number.isSafeInteger(cantidad) || cantidad < 0) {
      throw new ErrorDinero(`La cantidad debe ser un entero no negativo: ${cantidad}`);
    }
    return Dinero.desdeCentavos(this.centavos * cantidad);
  }

  igualA(otro: Dinero): boolean {
    return this.centavos === otro.centavos;
  }

  esCero(): boolean {
    return this.centavos === 0;
  }

  /** Texto decimal con dos decimales («12.50»), para enviar a la API. */
  aTexto(): string {
    const enteros = Math.trunc(this.centavos / 100);
    const decimales = (this.centavos % 100).toString().padStart(2, '0');
    return `${enteros}.${decimales}`;
  }

  /** Formato de Ecuador para mostrar en pantalla («$1.234,56»). */
  formatear(): string {
    // La división solo se usa para presentar, nunca para calcular: n/100 con dos
    // decimales se redondea siempre al mismo monto exacto al formatear.
    return FORMATO_MONEDA.format(this.centavos / 100);
  }
}
