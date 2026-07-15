import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';

beforeEach(() => {
  window.history.replaceState({}, '', '/orientador-ia/mercado');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('MarketIntelPage (Inteligencia de mercado, D-028, sin login)', () => {
  it('se carga sin autenticación y muestra las métricas del sector por defecto (desarrollo)', async () => {
    render(<App />);

    expect(await screen.findByTestId('market-intel-page')).toBeInTheDocument();
    expect(screen.getByText('Ofertas activas hoy')).toBeInTheDocument();
    expect(screen.getByText('15.280')).toBeInTheDocument(); // ofertas de "desarrollo" en España
  });

  it('cambiar de sector actualiza las métricas mostradas', async () => {
    render(<App />);
    await screen.findByTestId('market-intel-page');

    fireEvent.click(screen.getByTestId('market-sector-tab-marketing'));

    // es-ES (CLDR minimumGroupingDigits=2) no agrupa números de 4 dígitos con
    // un solo dígito inicial — "8420" se muestra sin separador de miles,
    // a diferencia de "15.280" (5 dígitos) en el test anterior.
    expect(screen.getByText('8420')).toBeInTheDocument(); // ofertas de "marketing" en España
    expect(screen.getByText('Generative AI content')).toBeInTheDocument();
  });

  it('el CTA de vuelta lleva a la entrevista (landing de orientador-ia)', async () => {
    render(<App />);
    await screen.findByTestId('market-intel-page');

    const cta = screen.getByText('Hacer la entrevista →');
    expect(cta.closest('a')).toHaveAttribute('href', '/orientador-ia');
  });
});
