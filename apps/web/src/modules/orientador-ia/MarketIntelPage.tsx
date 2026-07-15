import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { OrientadorSector } from '@awk/types';
import { REFACTIKA_CSS_VARS } from './refactika-theme';
import { ComingSoonToast, RefactikaHeader } from './RefactikaHeader';
import { SECTOR_ICONS, SECTOR_LABELS, SECTOR_OPTIONS } from './sector-labels';
import { MARKET_DATA, MARKET_INTRO_THEMES, MARKET_SOURCES } from './market-intel-data';

/**
 * "Inteligencia de mercado" — sección pública y libre (sin entrevista, sin
 * consentimiento) del prototipo original de Refactika, replicada tal cual
 * (D-028): datos de empleo, salarios, penetración de IA, ciudades, empresas
 * que contratan y tendencias por sector, solo mercado España (D-025).
 * Fuente del contenido: `legacy/backend/uploads/*orientadorRefactika.zip`
 * (componente `MarketIntel`, `app.js`) — ver `market-intel-data.ts`.
 */
export function MarketIntelPage() {
  const [activeSector, setActiveSector] = useState<OrientadorSector>('desarrollo');
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const data = MARKET_DATA[activeSector];
  const sectorLabel = SECTOR_LABELS[activeSector];
  const aiPct = Math.round((data.aiOffers / data.offers) * 100);
  const salaryBoost = Math.round((data.growthPct + 30) * 0.6);

  return (
    <div
      style={REFACTIKA_CSS_VARS}
      className="min-h-screen bg-[var(--rf-cream)] text-[var(--rf-navy)]"
      data-testid="market-intel-page"
    >
      <RefactikaHeader onComingSoon={setComingSoon} />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--rf-orange)]">
            Inteligencia de mercado
          </span>
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Actualizado hoy
          </span>
        </div>
        <h1 className="max-w-3xl text-3xl font-black leading-tight md:text-4xl">
          Formarse en <span style={{ color: 'var(--rf-orange)' }}>IA</span> hoy es una obligación, no una opción.
        </h1>
        <p className="mt-3 max-w-3xl text-[var(--rf-muted)]">
          Mira cómo la <span className="font-semibold text-[var(--rf-navy)]">IA</span> está transformando tu sector
          en <span className="font-semibold text-[var(--rf-navy)]">España</span>. Datos en lenguaje simple — sin
          jerga, sin humo. Empleo real, salarios y empresas que están contratando hoy.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {MARKET_INTRO_THEMES.map((theme) => (
            <div key={theme.title} className="rounded-2xl border border-[var(--rf-border)] bg-white p-4">
              <p className="text-xs font-bold text-[var(--rf-orange)]">LO QUE DICE EL MERCADO · McKinsey 2026</p>
              <p className="mt-1 text-sm font-bold">{theme.title}</p>
              <p className="mt-1 text-xs text-[var(--rf-muted)]">{theme.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2" data-testid="market-sector-tabs">
          {SECTOR_OPTIONS.map((sector) => (
            <button
              key={sector}
              type="button"
              onClick={() => setActiveSector(sector)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeSector === sector
                  ? 'bg-[var(--rf-navy)] text-white'
                  : 'border border-[var(--rf-border)] bg-white hover:border-[var(--rf-orange)]'
              }`}
              data-testid={`market-sector-tab-${sector}`}
            >
              <span>{SECTOR_ICONS[sector]}</span>
              <span>{SECTOR_LABELS[sector]}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon="💼"
            big={data.offers.toLocaleString('es-ES')}
            title="Ofertas activas hoy"
            plain={`Trabajos abiertos para ${sectorLabel.toLowerCase()} en España en este momento.`}
            accent
          />
          <MetricCard
            icon="🤖"
            big={`${aiPct}%`}
            title="Piden saber de IA"
            plain={`De cada 100 ofertas, ${aiPct} mencionan habilidades de IA. Las demás también lo necesitarán pronto.`}
            warning={aiPct >= 40 ? 'Sin IA estás compitiendo solo por la mitad de las ofertas.' : undefined}
          />
          <MetricCard
            icon="💰"
            big={`${(data.avgSalaryEur / 1000).toFixed(0)}K €`}
            title="Salario medio"
            plain={`Salario bruto anual típico para ${sectorLabel.toLowerCase()} en España.`}
          />
          <MetricCard
            icon="⚡"
            big={`+${salaryBoost}%`}
            title="Ganan los que saben IA"
            plain={`Los perfiles con IA ganan en promedio ${salaryBoost}% más que el resto del sector.`}
            accent
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--rf-border)] bg-white p-5">
            <h3 className="font-bold">🇪🇸 Dónde hay más trabajo en España</h3>
            <p className="mb-4 mt-1 text-xs text-[var(--rf-muted)]">
              Ciudades con más ofertas activas para {sectorLabel.toLowerCase()}. La barra muestra el peso relativo.
            </p>
            <div className="space-y-2.5">
              {data.cities.map(([city, weight], i) => (
                <div key={city} className="flex items-center gap-3">
                  <span className="w-4 text-xs text-[var(--rf-muted)]">{i + 1}</span>
                  <span className="w-28 truncate text-sm font-medium">{city}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--rf-border)]">
                    <span className="block h-full rounded-full" style={{ width: `${weight}%`, backgroundColor: 'var(--rf-orange)' }} />
                  </span>
                  <span className="w-7 text-right text-xs tabular-nums text-[var(--rf-muted)]">{weight}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--rf-border)] bg-white p-5">
            <h3 className="font-bold">Lo que piden las ofertas</h3>
            <p className="mb-4 mt-1 text-xs text-[var(--rf-muted)]">
              De cada 100 ofertas activas, qué porcentaje pide cada habilidad.
            </p>
            <div className="space-y-2.5">
              {data.hotSkills.map((sk, i) => (
                <div key={sk.skill} className="flex items-center gap-3">
                  <span className="w-4 text-xs text-[var(--rf-muted)]">{i + 1}</span>
                  <span className="flex-1 truncate text-sm">{sk.skill}</span>
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--rf-border)]">
                    <span className="block h-full rounded-full" style={{ width: `${sk.demand}%`, backgroundColor: 'var(--rf-orange)' }} />
                  </span>
                  <span className="w-9 text-right text-xs font-bold tabular-nums" style={{ color: 'var(--rf-orange)' }}>
                    {sk.demand}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--rf-border)] bg-white p-5">
            <h3 className="font-bold">Empresas que contratan en España</h3>
            <p className="mb-3 mt-1 text-xs text-[var(--rf-muted)]">
              Compañías que buscan profesionales con IA en este sector.
            </p>
            <div className="flex flex-wrap gap-2">
              {data.companies.map((company) => (
                <span key={company} className="rounded-full bg-[var(--rf-cream)] px-3 py-1.5 text-sm font-medium">
                  {company}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-5" style={{ backgroundColor: 'rgba(255,106,0,0.06)', borderColor: 'rgba(255,106,0,0.25)' }}>
            <h3 className="font-bold">Lo que más está creciendo</h3>
            <p className="mb-3 mt-1 text-xs text-[var(--rf-muted)]">
              Tendencias que se disparan en este sector. Fórmate aquí y vas por delante.
            </p>
            <div className="space-y-2">
              {data.trends.map((trend) => (
                <div key={trend.label} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                  <span className="text-sm">{trend.label}</span>
                  <span className="text-sm font-black" style={{ color: 'var(--rf-orange)' }}>
                    {trend.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-2xl p-5 text-white" style={{ backgroundColor: 'var(--rf-navy)' }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--rf-orange)' }}>
            De dónde vienen estos datos
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {MARKET_SOURCES.map((src) => (
              <div key={src.name} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs font-bold">{src.name}</p>
                <p className="mt-0.5 text-[10px] text-white/60">{src.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border-2 p-5 sm:flex-row sm:items-center" style={{ borderColor: 'var(--rf-orange)' }}>
          <div>
            <p className="font-bold">¿Quieres un plan personal en este sector?</p>
            <p className="mt-0.5 text-sm text-[var(--rf-muted)]">
              Haz la entrevista y te damos tu camino en <span className="font-bold" style={{ color: 'var(--rf-orange)' }}>IA</span> aplicada
              a {sectorLabel.toLowerCase()}.
            </p>
          </div>
          <Link
            to="/orientador-ia"
            className="whitespace-nowrap rounded-xl bg-[var(--rf-navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
          >
            Hacer la entrevista →
          </Link>
        </div>
      </main>

      <ComingSoonToast label={comingSoon} onClose={() => setComingSoon(null)} />
    </div>
  );
}

function MetricCard({
  icon,
  big,
  title,
  plain,
  accent,
  warning
}: {
  icon: string;
  big: string;
  title: string;
  plain: string;
  accent?: boolean;
  warning?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: accent ? 'rgba(255,106,0,0.3)' : 'var(--rf-border)',
        backgroundColor: accent ? 'rgba(255,106,0,0.06)' : 'white'
      }}
    >
      <p className="text-2xl">{icon}</p>
      <p className="mt-1 text-2xl font-black">{big}</p>
      <p className="mt-1 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-[var(--rf-muted)]">{plain}</p>
      {warning && (
        <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--rf-orange)' }}>
          ⚠️ {warning}
        </p>
      )}
    </div>
  );
}
