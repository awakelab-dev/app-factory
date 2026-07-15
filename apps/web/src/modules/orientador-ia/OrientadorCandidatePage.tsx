import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
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
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Link2,
  Mail,
  Mic,
  MicOff,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Upload
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { downloadItineraryPdf } from './itinerary-pdf';
import { extractPdfText } from './pdf-text-extract';
import { REFACTIKA_CSS_VARS } from './refactika-theme';
import { ComingSoonToast, RefactikaHeader } from './RefactikaHeader';
import { LEVEL_CARDS, SECTOR_ICONS, SECTOR_LABELS, SECTOR_OPTIONS } from './sector-labels';
import { useSpeechToText } from './use-speech-to-text';

type Step = 'landing' | 'consent' | 'step1' | 'step2' | 'result';

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
 * Flujo público de orientación de carrera (candidato, sin login — D-025/
 * D-027). Identidad visual Refactika, no Awakelab (D-028) — ver
 * `refactika-theme.ts`. Reproduce el prototipo original (capturas de
 * Leonardo, 2026-07-15): landing → consentimiento RGPD → paso 1 (meta +
 * sectores, estilo chat) → paso 2 (historia/LinkedIn/CV + nivel) →
 * "analizando" → resultado + PDF. Todo el estado vive en memoria de este
 * componente (sin backend de sesión, el candidato no tiene cuenta).
 */
export function OrientadorCandidatePage() {
  const [step, setStep] = useState<Step>('landing');
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [consent, setConsent] = useState<ConsentData>(EMPTY_CONSENT);
  const [metaText, setMetaText] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<OrientadorSector[]>([]);
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

  function restart() {
    setConsent(EMPTY_CONSENT);
    setMetaText('');
    setSelectedSectors([]);
    setResult(null);
    setStep('landing');
  }

  return (
    <div
      style={REFACTIKA_CSS_VARS}
      className="min-h-screen bg-[var(--rf-cream)] text-[var(--rf-navy)]"
      data-testid="orientador-candidate-page"
    >
      <RefactikaHeader onComingSoon={setComingSoon} />

      <main className="mx-auto max-w-4xl px-6 py-14">
        {step === 'landing' && <LandingView onStart={() => setStep('consent')} />}

        {step === 'consent' && (
          <ConsentView
            initial={consent}
            onBack={() => setStep('landing')}
            onSubmit={(data) => {
              setConsent(data);
              setStep('step1');
            }}
          />
        )}

        {step === 'step1' && (
          <Step1View
            firstName={consent.fullName.trim().split(' ')[0] || 'candidato'}
            metaText={metaText}
            selectedSectors={selectedSectors}
            onBack={() => setStep('consent')}
            onMetaChange={setMetaText}
            onSectorsChange={setSelectedSectors}
            onContinue={() => setStep('step2')}
          />
        )}

        {step === 'step2' && (
          <Step2View
            onBack={() => setStep('step1')}
            onResult={(response) => {
              setResult(response);
              setStep('result');
            }}
            consent={consent}
            metaText={metaText}
            selectedSectors={selectedSectors}
          />
        )}

        {step === 'result' && result && (
          <ResultView
            fullName={consent.fullName}
            result={result}
            academy={matchedAcademy}
            onRestart={restart}
            onComingSoon={setComingSoon}
          />
        )}
      </main>

      <ComingSoonToast label={comingSoon} onClose={() => setComingSoon(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landing
// ---------------------------------------------------------------------------

function LandingView({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <div className="text-center">
        <span
          className="inline-flex items-center gap-2 rounded-full border border-[var(--rf-border)] bg-white px-4 py-1.5 text-sm"
          data-testid="landing-eyebrow"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--rf-orange)' }} />
          Encuentra tu camino en la era de la <span className="font-semibold text-[var(--rf-orange)]">IA</span>
        </span>

        <h1 className="mx-auto mt-6 max-w-2xl text-5xl font-extrabold leading-[1.05] tracking-tight">
          ¿Hacia dónde quieres llevar tu carrera?
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--rf-muted)]">
          Te orientamos con <span className="font-semibold text-[var(--rf-navy)]">IA</span>. Cuéntanos tu
          proyecto, tus referencias o tu sector. En minutos sabrás qué aprender hoy y cómo llegar.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onStart}
            className="rounded-xl bg-[var(--rf-navy)] px-6 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90"
            data-testid="start-button"
          >
            Empezar la entrevista →
          </button>
          <Link
            to="/orientador-ia/mercado"
            className="rounded-xl border border-[var(--rf-border)] bg-white px-6 py-3.5 text-base font-semibold hover:bg-[var(--rf-cream)]"
          >
            📊 Inteligencia de mercado
          </Link>
        </div>

        <p className="mt-4 text-sm text-[var(--rf-muted)]">
          🕐 3 min · Entrevista con consentimiento · Inteligencia de mercado libre
        </p>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        <FeatureCard index="01" emoji="💬" title="¿Qué quieres hacer?">
          Una conversación breve. La IA detecta tu sector de impacto.
        </FeatureCard>
        <FeatureCard index="02" emoji="📄" title="¿Qué haces hoy?">
          Tu historia, LinkedIn o CV. Tú decides qué compartes.
        </FeatureCard>
        <FeatureCard index="03" emoji="🚀" title="Tu plan de IA">
          Escuela recomendada + timeline 4-6 meses con datos reales.
        </FeatureCard>
      </div>

      <div className="mt-8 rounded-2xl bg-[var(--rf-navy)] p-6 text-white">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
            style={{ backgroundColor: 'var(--rf-orange)' }}
          >
            IA
          </span>
          <div>
            <p className="font-semibold">El conocimiento de IA acelera tu carrera.</p>
            <p className="mt-1 text-sm text-white/70">
              Los perfiles con IA acceden a +30% de salario y 2.5x más ofertas en España.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  index,
  emoji,
  title,
  children
}: {
  index: string;
  emoji: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--rf-border)] bg-white p-6">
      <p className="text-sm font-semibold text-[var(--rf-orange)]">{index}</p>
      <p className="mt-2 text-2xl">{emoji}</p>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--rf-muted)]">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consentimiento RGPD (D-025: se mantiene, redactado correctamente)
// ---------------------------------------------------------------------------

function ConsentView({
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
    <div className="mx-auto max-w-md">
      <BackLink onClick={onBack} />
      <div className="mt-4 rounded-2xl border border-[var(--rf-border)] bg-white p-8">
        <ShieldCheck className="h-8 w-8" style={{ color: 'var(--rf-orange)' }} />
        <h2 className="mt-3 text-2xl font-bold">Antes de empezar</h2>
        <p className="mt-2 text-sm text-[var(--rf-muted)]">
          Necesitamos algunos datos de contacto para enviarte tu perfil y guardar tu progreso. Nunca
          compartimos tus datos con terceros sin tu consentimiento.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onFormSubmit}>
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

          <label className="flex items-start gap-2 text-sm">
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

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={data.consentMarketing}
              onChange={(e) => setData({ ...data, consentMarketing: e.target.checked })}
            />
            Acepto recibir comunicaciones sobre formaciones relacionadas (opcional).
          </label>

          {error && (
            <p className="text-sm text-red-600" data-testid="consent-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--rf-navy)] py-3 font-semibold text-white hover:opacity-90"
            data-testid="consent-submit"
          >
            Continuar
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 1 de 3 — chat: meta + selección de sectores
// ---------------------------------------------------------------------------

function Step1View({
  firstName,
  metaText,
  selectedSectors,
  onBack,
  onMetaChange,
  onSectorsChange,
  onContinue
}: {
  firstName: string;
  metaText: string;
  selectedSectors: OrientadorSector[];
  onBack: () => void;
  onMetaChange: (text: string) => void;
  onSectorsChange: (sectors: OrientadorSector[]) => void;
  onContinue: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [answered, setAnswered] = useState(metaText.length > 0);
  const speech = useSpeechToText((transcript) => setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript)));

  function submitMeta(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    onMetaChange(draft.trim());
    setAnswered(true);
  }

  function toggleSector(sector: OrientadorSector) {
    onSectorsChange(
      selectedSectors.includes(sector)
        ? selectedSectors.filter((s) => s !== sector)
        : [...selectedSectors, sector]
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink onClick={onBack} />
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--rf-orange)]">
        Paso 1 de 3 · ¿Qué quieres hacer?
      </p>
      <h2 className="mt-1 text-3xl font-extrabold">Cuéntame tu meta.</h2>
      <p className="mt-2 text-[var(--rf-muted)]">
        Preguntas mínimas. La IA detecta tu sector de impacto y pasamos al siguiente paso.
      </p>

      <div className="mt-6 rounded-2xl border border-[var(--rf-border)] bg-white p-6">
        <ChatHeader />

        <div className="mt-4 space-y-3">
          <AssistantBubble>
            Hola {firstName} 👋 Cuéntame en una frase: ¿qué te gustaría hacer o dónde quieres crecer con IA?
          </AssistantBubble>

          {answered && (
            <>
              <UserBubble>{metaText}</UserBubble>
              <AssistantBubble>
                No tengo claro aún el sector. Marca los que te interesen (puedes elegir varios):
              </AssistantBubble>
            </>
          )}
        </div>

        {!answered && (
          <form className="mt-4 flex items-center gap-2" onSubmit={submitMeta}>
            {speech.isSupported && (
              <button
                type="button"
                onClick={speech.toggle}
                title={speech.listening ? 'Detener dictado' : 'Hablar tu meta'}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
                  speech.listening ? 'border-[var(--rf-orange)] text-[var(--rf-orange)]' : 'border-[var(--rf-border)]'
                }`}
                data-testid="mic-button-meta"
              >
                {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe o habla tu meta..."
              className={`${inputClass} flex-1`}
              data-testid="meta-input"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--rf-orange)' }}
              data-testid="meta-submit"
            >
              Enviar
            </button>
          </form>
        )}

        {answered && (
          <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: 'rgba(255,106,0,0.08)' }}>
            <p className="text-sm font-semibold">Sectores elegidos ({selectedSectors.length})</p>
            <div className="mt-3 flex flex-wrap gap-2" data-testid="sector-chips">
              {SECTOR_OPTIONS.map((sector) => {
                const active = selectedSectors.includes(sector);
                return (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => toggleSector(sector)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? 'border-[var(--rf-orange)] bg-[var(--rf-orange)] text-white'
                        : 'border-[var(--rf-border)] bg-white hover:bg-[var(--rf-cream)]'
                    }`}
                    data-testid={`sector-chip-${sector}`}
                  >
                    {SECTOR_ICONS[sector]} {SECTOR_LABELS[sector]}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={onContinue}
              disabled={selectedSectors.length === 0}
              className="mt-4 w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--rf-orange)' }}
              data-testid="sectors-continue"
            >
              Continuar con {selectedSectors.length} sector{selectedSectors.length === 1 ? '' : 'es'} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--rf-border)] pb-4">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
        style={{ backgroundColor: 'var(--rf-navy)' }}
      >
        IA
      </span>
      <div>
        <p className="font-semibold">
          Orientador<span style={{ color: 'var(--rf-orange)' }}>IA</span>
        </p>
        <p className="flex items-center gap-1 text-xs text-green-600">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> En línea
        </p>
      </div>
    </div>
  );
}

function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[var(--rf-cream)] px-4 py-3 text-sm">{children}</div>
  );
}

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div
      className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white"
      style={{ backgroundColor: 'var(--rf-navy)' }}
      data-testid="meta-answer-bubble"
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 2 de 3 — historia/LinkedIn/CV + nivel
// ---------------------------------------------------------------------------

function Step2View({
  onBack,
  onResult,
  consent,
  metaText,
  selectedSectors
}: {
  onBack: () => void;
  onResult: (response: OrientadorIntakeResponse) => void;
  consent: ConsentData;
  metaText: string;
  selectedSectors: OrientadorSector[];
}) {
  const [mode, setMode] = useState<OrientadorInputType>('story');
  const [text, setText] = useState('');
  const [level, setLevel] = useState<OrientadorLevel>('inicial');
  const [extracting, setExtracting] = useState(false);
  // 'analyzing' se mantiene DENTRO de este mismo componente (no como un paso
  // separado del padre): si el fetch falla necesitamos volver a mostrar el
  // formulario con su error, y eso solo es fiable si el estado (`error`,
  // `text`, `mode`, `level`) nunca se desmonta durante el intento — un paso
  // 'analyzing' en el nivel del padre habría remontado este componente desde
  // cero al volver, perdiendo el mensaje de error.
  const [phase, setPhase] = useState<'form' | 'analyzing'>('form');
  const [error, setError] = useState<string | null>(null);
  const speech = useSpeechToText((transcript) => setText((prev) => (prev ? `${prev} ${transcript}` : transcript)));

  async function onFileChange(file: File | null) {
    if (!file) return;
    setError(null);
    setExtracting(true);
    try {
      setText(await extractPdfText(file));
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
    setPhase('analyzing');
    try {
      const sectorContext =
        selectedSectors.length > 0
          ? `\n\nSectores de interés declarados: ${selectedSectors.map((s) => SECTOR_LABELS[s]).join(', ')}.`
          : '';
      const rawInputText = `Meta declarada: ${metaText}\n\n${text}${sectorContext}`.slice(0, MAX_RAW_TEXT);

      const response = await apiFetch('/api/orientador-ia/intake', orientadorIntakeResponseSchema, {
        method: 'POST',
        body: JSON.stringify({
          fullName: consent.fullName.trim(),
          email: consent.email.trim(),
          phone: consent.phone.trim() || undefined,
          consentGiven: true,
          consentMarketing: consent.consentMarketing,
          rawInputType: mode,
          rawInputText,
          declaredSector: selectedSectors[0],
          declaredLevel: level
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
      setPhase('form');
    }
  }

  if (phase === 'analyzing') {
    return (
      <AnalyzingView
        firstName={consent.fullName.trim().split(' ')[0] || 'candidato'}
        primarySector={selectedSectors[0]}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink onClick={onBack} />
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--rf-orange)]">
        Paso 2 de 3 · ¿Qué haces?
      </p>
      <h2 className="mt-1 text-3xl font-extrabold">Cuéntame qué haces hoy.</h2>
      <p className="mt-2 text-[var(--rf-muted)]">
        Elige cómo compartes tu experiencia. Cuanto más específico, mejor será tu plan de IA.
      </p>

      <form className="mt-6" onSubmit={(e) => void onFormSubmit(e)}>
        <div className="flex gap-2 rounded-xl border border-[var(--rf-border)] bg-white p-1" role="tablist">
          <ModeTab icon={FileText} label="Tu historia" active={mode === 'story'} onClick={() => setMode('story')} />
          <ModeTab icon={Link2} label="LinkedIn" active={mode === 'linkedin_url'} onClick={() => setMode('linkedin_url')} />
          <ModeTab icon={Upload} label="CV (PDF)" active={mode === 'cv_pdf'} onClick={() => setMode('cv_pdf')} />
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--rf-border)] bg-white p-5">
          {mode === 'story' && (
            <>
              <label className="mb-2 block text-sm font-semibold">Tu experiencia en una historia breve</label>
              <div className="flex items-start gap-2">
                <textarea
                  rows={5}
                  maxLength={MAX_RAW_TEXT}
                  placeholder="Cuéntanos tu trayectoria, lo que te gusta hacer, y lo que buscas..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className={`${inputClass} flex-1`}
                  data-testid="story-textarea"
                />
                {speech.isSupported && (
                  <button
                    type="button"
                    onClick={speech.toggle}
                    title={speech.listening ? 'Detener dictado' : 'Hablar tu historia'}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
                      speech.listening ? 'border-[var(--rf-orange)] text-[var(--rf-orange)]' : 'border-[var(--rf-border)]'
                    }`}
                    data-testid="mic-button-story"
                  >
                    {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--rf-muted)]">
                {text.length} caracteres · menciona herramientas, cargos y años.
              </p>
            </>
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
                className="text-sm"
                data-testid="cv-input"
              />
              {extracting && <p className="mt-2 text-sm text-[var(--rf-muted)]">Leyendo tu CV…</p>}
              {!extracting && text && (
                <p className="mt-2 max-h-28 overflow-y-auto rounded-lg bg-[var(--rf-cream)] p-3 text-xs text-[var(--rf-muted)]">
                  {text}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" style={{ color: 'var(--rf-orange)' }} /> ¿Dónde estás hoy con la IA?
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {LEVEL_CARDS.map((card) => (
              <button
                key={card.level}
                type="button"
                onClick={() => setLevel(card.level)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  level === card.level ? 'border-[var(--rf-orange)] bg-[rgba(255,106,0,0.06)]' : 'border-[var(--rf-border)] bg-white'
                }`}
                data-testid={`level-card-${card.level}`}
              >
                <p className="text-xl">{card.icon}</p>
                <p className="mt-1 font-semibold">{card.title}</p>
                <p className="mt-1 text-xs text-[var(--rf-muted)]">{card.description}</p>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600" data-testid="input-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={extracting}
          className="mt-6 w-full rounded-xl bg-[var(--rf-navy)] py-3.5 font-semibold text-white disabled:opacity-50"
          data-testid="analyze-button"
        >
          Generar mi itinerario →
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analizando (animación cosmética, atada al fin real del fetch)
// ---------------------------------------------------------------------------

function AnalyzingView({ firstName, primarySector }: { firstName: string; primarySector?: OrientadorSector }) {
  const sectorLabel = primarySector ? SECTOR_LABELS[primarySector] : 'tu sector';
  const items = [
    'Leyendo tu perfil…',
    'Cruzando con España…',
    `Detectando habilidades clave en ${sectorLabel}…`,
    'Calculando tu itinerario IA…',
    'Listo'
  ];
  // Avanza cada ~900ms pero nunca revela el último ítem por tiempo — el
  // componente padre desmonta esta vista en cuanto el fetch real resuelve
  // (éxito → 'result', error → vuelve a 'step2'), así que "Listo" solo se
  // vería si la respuesta llega justo a tiempo; no hay temporizador que la
  // fuerce a mostrarse sin que el análisis haya terminado de verdad.
  const [visibleCount, setVisibleCount] = useState(1);
  useEffect(() => {
    if (visibleCount >= items.length - 1) return;
    const id = setTimeout(() => setVisibleCount((n) => n + 1), 900);
    return () => clearTimeout(id);
  }, [visibleCount, items.length]);

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rf-orange)]">Analizando tu perfil</p>
      <h2 className="mt-1 text-3xl font-extrabold">
        Trabajando con <span style={{ color: 'var(--rf-orange)' }}>IA</span>…
      </h2>
      <p className="mt-2 text-[var(--rf-muted)]">{firstName}, en unos segundos tendrás tu itinerario.</p>

      <div className="relative mx-auto mt-8 h-24 w-24">
        <div
          className="absolute inset-0 animate-spin rounded-full border-4 border-transparent"
          style={{ borderTopColor: 'var(--rf-orange)' }}
        />
        <div
          className="absolute inset-3 flex items-center justify-center rounded-2xl text-sm font-bold text-white"
          style={{ backgroundColor: 'var(--rf-navy)' }}
        >
          IA
        </div>
      </div>

      <div className="mt-8 space-y-3 text-left" data-testid="analyzing-checklist">
        {items.map((item, i) => (
          <div key={item} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                i < visibleCount ? 'text-white' : 'bg-[var(--rf-border)] text-transparent'
              }`}
              style={i < visibleCount ? { backgroundColor: 'var(--rf-orange)' } : undefined}
            >
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <span className={i < visibleCount ? '' : 'text-[var(--rf-muted)]'}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

function ResultView({
  fullName,
  result,
  academy,
  onRestart,
  onComingSoon
}: {
  fullName: string;
  result: OrientadorIntakeResponse;
  academy: OrientadorAcademy | null;
  onRestart: () => void;
  onComingSoon: (label: string) => void;
}) {
  const { profile } = result;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-[var(--rf-border)] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rf-orange)]">
              Escuela recomendada
            </p>
            <h2 className="mt-1 text-2xl font-extrabold">{academy?.name ?? SECTOR_LABELS[profile.recommendedSector]}</h2>
            <p className="mt-1 text-sm text-[var(--rf-muted)]" data-testid="recommended-sector">
              {SECTOR_LABELS[profile.recommendedSector]}
            </p>
          </div>
          {academy && (
            <div className="text-right">
              <p className="text-xs text-[var(--rf-muted)]">Desde</p>
              <p className="text-xl font-bold">{academy.priceEur}</p>
            </div>
          )}
        </div>
        {academy && (
          <p className="mt-1 text-sm text-[var(--rf-muted)]">
            {academy.duration} · {academy.synchronous}
          </p>
        )}

        {academy && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoBox tone="orange" icon="🎥" title="Sincrónico">
              {academy.synchronous}
            </InfoBox>
            <InfoBox tone="gray" icon="📚" title="Asincrónico">
              {academy.asynchronous}
            </InfoBox>
          </div>
        )}

        {academy && (
          <div className="mt-4 rounded-xl p-4 text-white" style={{ backgroundColor: 'var(--rf-navy)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--rf-orange)' }}>
              Reto real
            </p>
            <p className="mt-1 text-sm">{academy.challenge}</p>
          </div>
        )}

        <div className="mt-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" style={{ color: 'var(--rf-orange)' }} /> Por qué este sector
          </p>
          <p className="mt-1 text-sm text-[var(--rf-muted)]">{profile.rationale}</p>
        </div>

        {academy && academy.modules.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold">Qué aprenderás</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {academy.modules.map((item, i) => (
                <div key={item} className="flex items-start gap-2 text-sm">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
                    style={{ backgroundColor: 'var(--rf-orange)' }}
                  >
                    {i + 1}
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.skillGaps.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold">Huecos de formación detectados</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--rf-muted)]">
              {profile.skillGaps.map((gap) => (
                <li key={gap} className="flex items-start gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {academy && academy.outcomes.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold">Al terminar podrás…</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {academy.outcomes.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => downloadItineraryPdf(fullName, profile, academy)}
          className="flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-white"
          style={{ backgroundColor: 'var(--rf-orange)' }}
          data-testid="download-pdf-button"
        >
          <Download className="h-4 w-4" /> Descargar itinerario PDF
        </button>
        <a
          href={`mailto:admisiones@refactika.com?subject=${encodeURIComponent(
            `Quiero que me contacten — ${academy?.name ?? 'Orientador IA'}`
          )}`}
          className="flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-white"
          style={{ backgroundColor: 'var(--rf-navy)' }}
        >
          <Mail className="h-4 w-4" /> Que me contacten
        </a>
        <button
          type="button"
          onClick={() => onComingSoon('Comprar online')}
          className="flex items-center gap-2 rounded-xl border border-[var(--rf-border)] bg-white px-5 py-3 font-semibold"
          data-testid="buy-online-button"
        >
          <ShoppingCart className="h-4 w-4" /> Comprar online
        </button>
      </div>

      <button type="button" onClick={onRestart} className="mt-4 text-sm text-[var(--rf-muted)] underline">
        Empezar de nuevo
      </button>
    </div>
  );
}

function InfoBox({
  tone,
  icon,
  title,
  children
}: {
  tone: 'orange' | 'gray';
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: tone === 'orange' ? 'rgba(255,106,0,0.1)' : 'var(--rf-cream)' }}
    >
      <p className="text-sm font-semibold">
        {icon} {title}
      </p>
      <p className="mt-1 text-sm text-[var(--rf-muted)]">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compartidos
// ---------------------------------------------------------------------------

const inputClass =
  'w-full rounded-lg border border-[var(--rf-border)] bg-white px-3 py-2 text-sm text-[var(--rf-navy)] placeholder:text-[var(--rf-muted)] focus:border-[var(--rf-orange)] focus:outline-none';

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-sm text-[var(--rf-muted)] hover:text-[var(--rf-navy)]">
      <ArrowLeft className="h-4 w-4" /> Volver
    </button>
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
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? 'bg-[var(--rf-navy)] text-white' : 'text-[var(--rf-muted)] hover:bg-[var(--rf-cream)]'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
