import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VistaPreviaMarca } from './vista-previa-marca';

describe('VistaPreviaMarca (D-43, RNF-11)', () => {
  let fixture: ComponentFixture<VistaPreviaMarca>;
  let elemento: HTMLElement;

  async function mostrar(entradas: { nombre?: string; color: string; acento?: string | null }) {
    fixture = TestBed.createComponent(VistaPreviaMarca);
    fixture.componentRef.setInput('nombre', entradas.nombre ?? 'Avon');
    fixture.componentRef.setInput('color', entradas.color);
    fixture.componentRef.setInput('colorAcento', entradas.acento ?? null);
    elemento = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const q = (id: string) => elemento.querySelector<HTMLElement>(`[data-prueba="${id}"]`);

  it('Avon: texto #0F172A sobre el rosa y «Contraste 4.9:1 ✔»', async () => {
    await mostrar({ color: '#FF2469' });
    expect(q('cabecera')?.style.backgroundColor).toBe('rgb(255, 36, 105)');
    expect(q('cabecera')?.style.color).toBe('rgb(15, 23, 42)');
    expect(q('contraste-principal')?.textContent).toContain('Contraste 4.9:1 ✔');
    expect(q('chip-acento')).toBeNull();
  });

  it('Leonisa: muestra el chip de acento con su texto y su contraste', async () => {
    await mostrar({ nombre: 'Leonisa', color: '#222221', acento: '#F36E21' });
    expect(q('chip-acento')?.style.backgroundColor).toBe('rgb(243, 110, 33)');
    expect(q('chip-acento')?.style.color).toBe('rgb(30, 41, 59)');
    expect(q('contraste-acento')?.textContent).toContain('✔');
  });

  it('con un color inválido no inventa un contraste', async () => {
    await mostrar({ color: '#12' });
    expect(q('contraste-principal')?.textContent).toContain('Elige un color válido');
  });
});
