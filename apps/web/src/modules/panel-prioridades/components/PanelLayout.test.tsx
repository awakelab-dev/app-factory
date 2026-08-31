import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PanelLayout } from './PanelLayout';

/**
 * El módulo tiene cinco rutas y UNA entrada en el menú del shell: si estas
 * pestañas desaparecen, cuatro pantallas quedan inalcanzables (D-058). Por eso
 * el test fija los cinco destinos, no solo que el componente renderice.
 */
function renderEn(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <PanelLayout>
        <p>contenido</p>
      </PanelLayout>
    </MemoryRouter>
  );
}

describe('PanelLayout', () => {
  it('enlaza las cinco pantallas del módulo', () => {
    renderEn('/panel-prioridades');
    const destinos = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(destinos).toEqual([
      '/panel-prioridades',
      '/panel-prioridades/week',
      '/panel-prioridades/delegations',
      '/panel-prioridades/metrics',
      '/panel-prioridades/team'
    ]);
  });

  it('marca activa SOLO la pestaña de la ruta actual (la raíz lleva `end`)', () => {
    renderEn('/panel-prioridades/week');
    const activas = screen
      .getAllByRole('link')
      .filter((a) => a.className.includes('border-awk-cyan-400'))
      .map((a) => a.textContent);
    expect(activas).toEqual(['Semana']);
  });

  it('pinta el contenido de la pantalla dentro de las pestañas', () => {
    renderEn('/panel-prioridades/team');
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });
});
