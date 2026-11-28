import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { FileUpload } from 'primeng/fileupload';

import { ESPERA } from '../../aplicacion/estado-fotos-lote';
import { ApiProductos } from '../../aplicacion/puertos';
import {
  ApiProductosFalsa,
  archivoPrueba,
  crearApiProductosFalsa,
  imagenPrueba,
  paginaPrueba,
  productoPrueba,
} from '../../pruebas/dobles-productos';
import { FotosLote } from './fotos-lote';

describe('FotosLote: subir fotos en lote (RF-PRO-01, D-62, DEC-07)', () => {
  let api: ApiProductosFalsa;
  let avisos: { add: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<FotosLote>;
  let elemento: HTMLElement;

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const porPrueba = (nombre: string) => elemento.querySelectorAll(`[data-prueba="${nombre}"]`);

  function elegir(archivos: File[]): void {
    const cargador = fixture.debugElement.query(By.directive(FileUpload)).componentInstance as FileUpload;
    cargador.onSelect.emit({ originalEvent: new Event('change'), files: archivos, currentFiles: archivos });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    api = crearApiProductosFalsa();
    api.listar.mockResolvedValue(
      paginaPrueba([
        productoPrueba('p1', 'Crema hidratante', { codigo: '12345' }),
        productoPrueba('p2', 'Labial rojo', { codigo: '777' }),
      ]),
    );
    api.subirImagen.mockResolvedValue(imagenPrueba('nueva', 0));
    avisos = { add: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [FotosLote],
      providers: [
        provideRouter([]),
        { provide: ApiProductos, useValue: api },
        { provide: MessageService, useValue: avisos },
        { provide: ESPERA, useValue: () => Promise.resolve() },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FotosLote);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await estable();
  });

  it('carga los productos y muestra el cargador; sin fotos no hay botón de subir', () => {
    expect(api.listar).toHaveBeenCalledWith({ pagina: 1, tamanio: 100 });
    expect(porPrueba('cargador')).toHaveLength(1);
    expect(porPrueba('subir')).toHaveLength(0);
    expect(elemento.textContent).toContain('12345.jpg');
  });

  it('las fotos elegidas se revisan antes de guardar: emparejadas, con avisos y nada se sube todavía', async () => {
    elegir([
      archivoPrueba('12345.jpg', 50_000, 'image/jpeg'),
      archivoPrueba('777-2.jpg', 50_000, 'image/jpeg'),
      archivoPrueba('99999.jpg', 50_000, 'image/jpeg'),
    ]);
    await estable();

    expect(porPrueba('fila-foto')).toHaveLength(3);
    expect(porPrueba('lista-foto')).toHaveLength(2);
    expect(porPrueba('aviso-foto')[0]?.textContent).toContain('Ningún producto tiene ese código');
    expect(porPrueba('resumen')[0]?.textContent).toContain('2 listas para subir');
    expect(porPrueba('subir')[0]?.textContent).toContain('Subir 2 fotos');
    expect(api.subirImagen).not.toHaveBeenCalled();
  });

  it('al confirmar sube las listas, muestra el resultado y avisa con un toast', async () => {
    const confirmacion = fixture.debugElement.injector.get(ConfirmationService);
    let pedida: Confirmation | undefined;
    vi.spyOn(confirmacion, 'confirm').mockImplementation((opciones: Confirmation) => {
      pedida = opciones;
      return confirmacion;
    });
    elegir([archivoPrueba('12345.jpg', 50_000, 'image/jpeg'), archivoPrueba('777.jpg', 50_000, 'image/jpeg')]);
    await estable();

    (porPrueba('subir')[0]?.querySelector('button') as HTMLButtonElement).click();
    expect(pedida?.message).toContain('Se subirán 2 fotos a 2 productos');
    expect(pedida?.message).toContain('30 por minuto');
    pedida?.accept?.();
    await estable();

    expect(api.subirImagen).toHaveBeenCalledTimes(2);
    expect(porPrueba('progreso-foto')).toHaveLength(2);
    expect(porPrueba('final')[0]?.textContent).toContain('Subidas: 2');
    expect(avisos.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    expect(porPrueba('nuevo-lote')).toHaveLength(1);
  });
});
