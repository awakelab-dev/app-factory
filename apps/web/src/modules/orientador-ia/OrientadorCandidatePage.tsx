import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  orientadorAcademiesResponseSchema,
  orientadorIntakeResponseSchema,
  type OrientadorAcademy,
  type OrientadorInputType,
  type OrientadorIntakeResponse,
  type OrientadorLevel,
  type OrientadorSector
} from '@awk/types';
import {
  Briefcase,
  Compass,
  Download,
  FileText,
  Link2,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@awk/ui';
import { ApiError, apiFetch } from '../../lib/api';
import { downloadItineraryPdf } from './itinerary-pdf';
import { extractPdfText } from './pdf-text-extract';
import { LEVEL_LABELS, LEVEL_OPTIONS, SECTOR_LABELS, SECTOR_OPTIONS } from './sector-labels';

type Step = 'landing' | 'consent' | 'input' | 'result';

interface ConsentData {
  fullName: string;
  email: string;
  phone: string;
  consentGiven: boolean;
  consentMarketing: boolean;
}

const EMPTY_CONSENT: ConsentData = {
  fullName: '',
  email: '',
  phone: '',
  consentGiven: false,
  consentMarketing: false
};

const MAX_RAW_TEXT = 2000;

/**
 * Flujo público de orientación de carrera (candidato, sin login — D-025/D-027).
 * Wizard de una sola ruta (`/orientador-ia`, ver module.manifest/index.tsx):
 * landing → consentimiento RGPD → historia/LinkedIn/CV → resultado + PDF.
 * Todo el estado del wizard vive en memoria de este componente (sin backend
 * de sesión: el candidato no tiene cuenta, así que no hay dónde persistirlo
 * entre pasos salvo aquí).
 */
export function OrientadorCandidatePage() {
  const [step, setStep] = useState<Step>('landing');
  const [consent, setConsent] = useState<ConsentData>(EMPTY_CONSENT);
  const [academies, setAcademies] = useState<OrientadorAcademy[]>([]);
  const [result, setResult] = useState<OrientadorIntakeResponse | null>(null);

  useEffect(() => {
    apiFetch('/api/orientador-ia/academies', orientadorAcademiesResponseSchema)
      .then(setAcademies)
      .catch(() => setAcademies([])); // el plan sigue siendo útil sin el detalle de academias
  }, []);

  const matchedAcademy = result
    ? (academies.find((a) => a.sector === result.profile.recommendedSector) ?? null)
    : null;

  return (
    <div
      className="min-h-screen bg-awk-navy-900 font-sans text-awk-blue-50"
      data-testid="orientador-candidate-page"
    >
      <header className="border-b border-awk-blue-800 px-6 py-5">
        <img
          src="https://media.awakelab.world/MARCA_AWK26/awakelab_logo_fondo-oscuro_transparente.png"
          alt="Awakelab"
          className="h-8"
        />
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {step === 'landing' && <LandingStep onStart={() => setStep('consent')} />}

        {step === 'consent' && (
          <ConsentStep
            initial={consent}
            onBack={() => setStep('landing')}
            onSubmit={(data) => {
              setConsent(data);
              setStep('input');
            }}
          />
        )}

        {step === 'input' && (
          <InputStep
            consent={consent}
            onBack={() => setStep('consent')}
            onResult={(response) => {
              setResult(response);
              setStep('result');
            }}
          />
        )}

        {step === 'result' && result && (
          <ResultStep
            fullName={consent.fullName}
            result={result}
            academy={matchedAcademy}
            onRestart={() => {
              setConsent(EMPTY_CONSENT);
              setResult(null);
              setStep('landing');
            }}
          />
        )}
      </main>
    </div>
  );
}

function LandingStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center">
      <Compass className="mx-auto h-10 w-10 text-awk-cyan-400" />
      <h1 className="mt-4 text-3xl font-semibold text-white">
        Orientador IA <span className="text-awk-cyan-400">·</span> encuentra tu próximo paso profesional
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-awk-blue-300">
        El mercado laboral español está en plena transformación por la IA. Cuéntanos tu historia y en
        segundos un análisis con IA te recomienda un sector y un itinerario de formación concretos.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
        {SECTOR_OPTIONS.slice(0, 6).map((sector) => (
          <div
            key={sector}
            className="rounded-lg border border-awk-blue-800 bg-awk-navy-800 px-3 py-2 text-sm text-awk-blue-100"
          >
            {SECTOR_LABELS[sector]}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-awk-blue-400">y {SECTOR_OPTIONS.length - 6} sectores más.</p>

      <Button className="mt-8" size="lg" onClick={onStart} data-testid="start-button">
        Empezar mi orientación gratis
      </Button>
      <p className="mt-3 text-xs text-awk-blue-400">
        Análisis gratuito. Tus datos se tratan conforme al RGPD (siguiente paso).
      </p>
    </div>
  );
}

function ConsentStep({
  initial,
  onBack,
  onSubmit
}: {
  initial: ConsentData;
  onBack: () => void;
  onSubmit: (data: ConsentData) => void;
}) {
  const [data, setData] = useState<ConsentData>(initial);
  const [error, setError] = useState<string | null>(null);

  function onFormSubmit(event: FormEvent) {
    event.preventDefault();
    if (!data.fullName.trim() || !data.email.trim()) {
      setError('Nombre y email son obligatorios.');
      return;
    }
    if (!data.consentGiven) {
      setError('Necesitamos tu consentimiento para analizar tus datos.');
      return;
    }
    setError(null);
    onSubmit(data);
  }

  return (
    <form className="mx-auto max-w-md" onSubmit={onFormSubmit}>
      <ShieldCheck className="h-8 w-8 text-awk-cyan-400" />
      <h2 className="mt-3 text-2xl font-semibold text-white">Antes de empezar</h2>
      <p className="mt-2 text-sm text-awk-blue-300">
        Necesitamos algunos datos de contacto para enviarte tu perfil y guardar tu progreso. Nunca
        compartimos tus datos con terceros sin tu consentimiento.
      </p>

      <div className="mt-6 space-y-4">
        <Field label="Nombre completo" htmlFor="fullName">
          <input
            id="fullName"
            required
            value={data.fullName}
            onChange={(e) => setData({ ...data, fullName: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            required
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Teléfono (opcional)" htmlFor="phone">
          <input
            id="phone"
            value={data.phone}
            onChange={(e) => setData({ ...data, phone: e.target.value })}
            className={inputClass}
          />
        </Field>

        <label className="flex items-start gap-2 text-sm text-awk-blue-100">
          <input
            type="checkbox"
            className="mt-1"
            checked={data.consentGiven}
            onChange={(e) => setData({ ...data, consentGiven: e.target.checked })}
            data-testid="consent-checkbox"
          />
          Doy mi consentimiento para que Awakelab y Grupo Aspasia/Refactika traten mis datos con el fin
          de generar mi perfil de orientación profesional (RGPD).
        </label>

        <label className="flex items-start gap-2 text-sm text-awk-blue-100">
          <input
            type="checkbox"
            className="mt-1"
            checked={data.consentMarketing}
            onChange={(e) => setData({ ...data, consentMarketing: e.target.checked })}
          />
          Acepto recibir comunicaciones sobre formaciones relacionadas (opcional).
        </label>

        {error && (
          <p className="text-sm text-red-400" data-testid="consent-error">
            {error}
          </p>
        )}

        <div className="flex justify-between pt-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            Atrás
          </Button>
          <Button type="submit" data-testid="consent-submit">
            Continuar
          </Button>
        </div>
      </div>
    </form>
  );
}

function InputStep({
  consent,
  onBack,
  onResult
}: {
  consent: ConsentData;
  onBack: () => void;
  onResult: (response: OrientadorIntakeResponse) => void;
}) {
  const [mode, setMode] = useState<OrientadorInputType>('story');
  const [text, setText] = useState('');
  const [declaredSector, setDeclaredSector] = useState<OrientadorSector | ''>('');
  const [declaredLevel, setDeclaredLevel] = useState<OrientadorLevel | ''>('');
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setError(null);
    setExtracting(true);
    try {
      const extracted = await extractPdfText(file);
      setText(extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el PDF.');
    } finally {
      setExtracting(false);
    }
  }

  async function onFormSubmit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) {
      setError('Cuéntanos algo sobre ti para poder analizarlo.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const response = await apiFetch('/api/orientador-ia/intake', orientadorIntakeResponseSchema, {
        method: 'POST',
        body: JSON.stringify({
          fullName: consent.fullName.trim(),
          email: consent.email.trim(),
          phone: consent.phone.trim() || undefined,
          consentGiven: true,
          consentMarketing: consent.consentMarketing,
          rawInputType: mode,
          rawInputText: text.slice(0, MAX_RAW_TEXT),
          declaredSector: declaredSector || undefined,
          declaredLevel: declaredLevel || undefined
        })
      });
      onResult(response);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Se alcanzó el límite de análisis para este email. Contacta con Grupo Aspasia si crees que es un error.');
      } else if (err instanceof ApiError && err.status === 503) {
        setError('El análisis con IA no está disponible en este momento. Inténtalo de nuevo en unos minutos.');
      } else {
        setError('No se pudo generar tu perfil. Puedes intentarlo de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mx-auto max-w-xl" onSubmit={(e) => void onFormSubmit(e)}>
      <Sparkles className="h-8 w-8 text-awk-cyan-400" />
      <h2 className="mt-3 text-2xl font-semibold text-white">Cuéntanos sobre ti</h2>
      <p className="mt-2 text-sm text-awk-blue-300">
        Elige cómo prefieres compartir tu experiencia — cuanto más contexto nos des, mejor será la
        recomendación.
      </p>

      <div className="mt-5 flex gap-2" role="tablist">
        <ModeTab icon={FileText} label="Mi historia" active={mode === 'story'} onClick={() => setMode('story')} />
        <ModeTab icon={Link2} label="LinkedIn" active={mode === 'linkedin_url'} onClick={() => setMode('linkedin_url')} />
        <ModeTab icon={Upload} label="Subir CV (PDF)" active={mode === 'cv_pdf'} onClick={() => setMode('cv_pdf')} />
      </div>

      <div className="mt-4">
        {mode === 'story' && (
          <textarea
            rows={7}
            maxLength={MAX_RAW_TEXT}
            placeholder="Cuéntanos tu trayectoria, lo que te gusta hacer, y lo que buscas..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inputClass}
            data-testid="story-textarea"
          />
        )}

        {mode === 'linkedin_url' && (
          <input
            type="url"
            placeholder="https://www.linkedin.com/in/tu-perfil"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inputClass}
            data-testid="linkedin-input"
          />
        )}

        {mode === 'cv_pdf' && (
          <div>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
              className="text-sm text-awk-blue-100"
              data-testid="cv-input"
            />
            {extracting && (
              <p className="mt-2 flex items-center gap-2 text-sm text-awk-blue-300">
                <Loader2 className="h-4 w-4 animate-spin" /> Leyendo tu CV…
              </p>
            )}
            {!extracting && text && (
              <p className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-awk-blue-800 bg-awk-navy-800 p-3 text-xs text-awk-blue-300">
                {text}
              </p>
            )}
          </div>
        )}
        <p className="mt-1 text-right text-xs text-awk-blue-500">
          {text.length}/{MAX_RAW_TEXT}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Sector que te interesa (opcional)" htmlFor="declaredSector">
          <select
            id="declaredSector"
            value={declaredSector}
            onChange={(e) => setDeclaredSector(e.target.value as OrientadorSector | '')}
            className={inputClass}
          >
            <option value="">Sin preferencia</option>
            {SECTOR_OPTIONS.map((sector) => (
              <option key={sector} value={sector}>
                {SECTOR_LABELS[sector]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tu nivel actual (opcional)" htmlFor="declaredLevel">
          <select
            id="declaredLevel"
            value={declaredLevel}
            onChange={(e) => setDeclaredLevel(e.target.value as OrientadorLevel | '')}
            className={inputClass}
          >
            <option value="">Sin especificar</option>
            {LEVEL_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400" data-testid="input-error">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          Atrás
        </Button>
        <Button type="submit" disabled={submitting || extracting} data-testid="analyze-button">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analizando…
            </>
          ) : (
            'Analizar mi perfil'
          )}
        </Button>
      </div>
    </form>
  );
}

function ResultStep({
  fullName,
  result,
  academy,
  onRestart
}: {
  fullName: string;
  result: OrientadorIntakeResponse;
  academy: OrientadorAcademy | null;
  onRestart: () => void;
}) {
  const { profile } = result;
  return (
    <div>
      <Sparkles className="h-8 w-8 text-awk-cyan-400" />
      <h2 className="mt-3 text-2xl font-semibold text-white">Tu perfil de orientación</h2>
      <p className="mt-1 text-sm text-awk-blue-300">
        Basado en la información que compartiste, esto es lo que recomendamos:
      </p>

      <div className="mt-6 rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6">
        <p className="text-xs uppercase tracking-wide text-awk-blue-400">Sector recomendado</p>
        <p className="mt-1 text-xl font-semibold text-awk-cyan-300" data-testid="recommended-sector">
          {SECTOR_LABELS[profile.recommendedSector]}
        </p>
        <p className="mt-1 text-sm text-awk-blue-300">{LEVEL_LABELS[profile.estimatedLevel]}</p>

        <p className="mt-4 text-sm text-awk-blue-100">{profile.rationale}</p>

        {profile.skillGaps.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-awk-blue-400">Huecos de formación</p>
            <ul className="mt-2 list-inside list-disc text-sm text-awk-blue-100">
              {profile.skillGaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {academy && (
        <div className="mt-6 rounded-xl border border-awk-cyan-700 bg-awk-navy-800 p-6">
          <div className="flex items-center gap-2 text-awk-cyan-300">
            <Briefcase className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wide">Itinerario recomendado</p>
          </div>
          <p className="mt-1 text-xl font-semibold text-white">{academy.name}</p>
          <p className="mt-1 text-sm text-awk-blue-300">
            {academy.duration} · {academy.priceEur} / {academy.priceUsd}
          </p>
          <p className="mt-3 text-sm text-awk-blue-100">{academy.challenge}</p>
          <a
            href={academy.purchaseUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm text-awk-cyan-400 underline"
          >
            Ver detalles y matricularme
          </a>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => downloadItineraryPdf(fullName, profile, academy)} data-testid="download-pdf-button">
          <Download className="h-4 w-4" /> Descargar itinerario en PDF
        </Button>
        <Button variant="ghost" onClick={onRestart}>
          Empezar de nuevo
        </Button>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50 placeholder:text-awk-blue-500 focus:border-awk-cyan-500 focus:outline-none';

function Field({
  label,
  htmlFor,
  children
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-awk-blue-100" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ModeTab({
  icon: Icon,
  label,
  active,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        active
          ? 'border-awk-cyan-500 bg-awk-cyan-500/10 text-awk-cyan-300'
          : 'border-awk-blue-800 text-awk-blue-300 hover:bg-awk-blue-800/40'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
