import { bytesUtf8, cumpleReglaClave } from './clave';

describe('regla de la clave (contrato de usuarios, D-22, RF-USU-05)', () => {
  it.each([
    ['8 caracteres con letras y números', 'Clave202'],
    ['72 caracteres', `${'a'.repeat(71)}1`],
    ['letras con tilde', 'Contraseña1'],
  ])('acepta %s', (_caso, clave) => {
    expect(cumpleReglaClave(clave)).toBe(true);
  });

  it.each([
    ['vacía', ''],
    ['7 caracteres', 'Clave20'],
    ['73 caracteres', `${'a'.repeat(72)}1`],
    ['solo letras', 'soloLetrasSinNumero'],
    ['solo números', '1234567890'],
    // 36 «ñ» (2 bytes cada una) + 1 dígito = 37 caracteres pero 73 bytes.
    ['más de 72 bytes aunque tenga menos de 72 caracteres', `${'ñ'.repeat(36)}1`],
  ])('rechaza una clave %s', (_caso, clave) => {
    expect(cumpleReglaClave(clave)).toBe(false);
  });

  it('cuenta los bytes en UTF-8', () => {
    expect(bytesUtf8('abc')).toBe(3);
    expect(bytesUtf8('ñ')).toBe(2);
  });
});
