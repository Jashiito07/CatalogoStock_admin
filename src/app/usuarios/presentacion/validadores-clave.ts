import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { cumpleReglaClave } from '../dominio/clave';

/** La clave cumple la regla del contrato (8 a 72 caracteres, ≤72 bytes, letras y números). */
export const validadorReglaClave: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor: unknown = control.value;
  if (typeof valor !== 'string' || valor === '') {
    return null; // De lo obligatorio se encarga `Validators.required`.
  }
  return cumpleReglaClave(valor) ? null : { reglaClave: true };
};

/**
 * Validador del grupo del cambio de clave: la confirmación coincide con la nueva y la
 * nueva es distinta de la actual (la API también lo comprueba: 400 DATOS_INVALIDOS).
 */
export function validadorCambioClave(
  campoActual: string,
  campoNueva: string,
  campoConfirmacion: string,
): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const actual: unknown = grupo.get(campoActual)?.value;
    const nueva: unknown = grupo.get(campoNueva)?.value;
    const confirmacion: unknown = grupo.get(campoConfirmacion)?.value;
    const errores: ValidationErrors = {};
    if (typeof nueva === 'string' && nueva !== '' && nueva === actual) {
      errores['igualALaActual'] = true;
    }
    if (typeof confirmacion === 'string' && confirmacion !== '' && confirmacion !== nueva) {
      errores['noCoinciden'] = true;
    }
    return Object.keys(errores).length > 0 ? errores : null;
  };
}
