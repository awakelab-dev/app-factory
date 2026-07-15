import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { REFACTIKA_COLORS } from './refactika-theme';

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Header público de orientador-ia (marca Refactika, D-028) — reutilizado por
 * la landing, el wizard y la página de "Inteligencia de mercado". El reloj en
 * vivo, el selector de país y el toggle LATAM son fieles al prototipo
 * original; país/región no tienen contenido real detrás todavía (single
 * mercado España, igual que el resto del módulo) así que muestran "Próximamente"
 * al tocarlos, mismo patrón que "Comprar online" (pedido explícito de Leonardo).
 */
export function RefactikaHeader({ onComingSoon }: { onComingSoon: (label: string) => void }) {
  const clock = useClock();

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--rf-border)] bg-white/90 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/orientador-ia" className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold tracking-tight text-[var(--rf-navy)]">
            Orientador<span style={{ color: REFACTIKA_COLORS.orange }}>IA</span>
          </span>
          <span className="text-xs text-[var(--rf-muted)]">
            by <span className="font-bold">REFACT</span>
            <span className="font-bold" style={{ color: REFACTIKA_COLORS.orange }}>
              IK
            </span>
            <span className="font-bold">A</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-[var(--rf-navy)] md:flex">
          <Link to="/orientador-ia/mercado" className="flex items-center gap-1.5 hover:opacity-70">
            <BarChart3 className="h-4 w-4" style={{ color: REFACTIKA_COLORS.orange }} />
            Inteligencia de mercado
          </Link>
          <button type="button" onClick={() => onComingSoon('API')} className="hover:opacity-70">
            API
          </button>
          <span className="text-[var(--rf-muted)]" data-testid="header-clock">
            {clock}
          </span>
          <span className="rounded-full border border-[var(--rf-border)] px-3 py-1 text-xs">🇪🇸 España</span>
          <button
            type="button"
            onClick={() => onComingSoon('Selector LATAM')}
            className="rounded-full border border-[var(--rf-border)] px-3 py-1 text-xs hover:bg-[var(--rf-cream)]"
          >
            🌐 LATAM
          </button>
        </nav>
      </div>
    </header>
  );
}

/** Toast mínimo para acciones "Próximamente" (comprar online, API, LATAM...). */
export function ComingSoonToast({ label, onClose }: { label: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!label) return;
    const id = setTimeout(onClose, 2500);
    return () => clearTimeout(id);
  }, [label, onClose]);

  if (!label) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-medium text-white shadow-lg"
      style={{ backgroundColor: REFACTIKA_COLORS.navy }}
      data-testid="coming-soon-toast"
    >
      {label}: Próximamente
    </div>
  );
}
