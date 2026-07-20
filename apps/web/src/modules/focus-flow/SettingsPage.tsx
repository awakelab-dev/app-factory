import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@awk/ui';
import { apiFetch } from '../../lib/api';
import { focusSettingsSchema, type FocusSettings, type UpdateFocusSettingsRequest } from './focus-flow.types';

type SettingsState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ok'; settings: FocusSettings };

const STEPPERS: Array<{
  key: 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'roundsBeforeLongBreak';
  label: string;
  hint: string;
  min: number;
  max: number;
}> = [
  { key: 'focusMinutes', label: 'Pomodoro', hint: 'Bloque de enfoque (minutos)', min: 1, max: 180 },
  { key: 'shortBreakMinutes', label: 'Descanso corto', hint: 'Entre pomodoros (minutos)', min: 1, max: 60 },
  { key: 'longBreakMinutes', label: 'Descanso largo', hint: 'Tras varios ciclos (minutos)', min: 1, max: 90 },
  { key: 'roundsBeforeLongBreak', label: 'Ciclos hasta descanso largo', hint: 'Pomodoros por serie', min: 1, max: 12 }
];

/** Rango del campo "Horas proyectadas por día" (change-3, spec-tecnica.md):
 * 1h–24h, en minutos (mismo criterio de cota amplia que el resto de
 * Configuración). */
const PROJECTED_FOCUS_MINUTES_MIN = 60;
const PROJECTED_FOCUS_MINUTES_MAX = 1440;

/**
 * Configuración (spec-tecnica.md `SettingsPage`): duración de fases, ciclos,
 * autoarranque y notificaciones — persistidos y con efecto real (gate
 * funcional, decisión 3). El interruptor "Sonido al terminar" del prototipo
 * NO existe aquí: se elimina de la UI del MVP (gate funcional, decisión 3).
 */
export function SettingsPage() {
  const [state, setState] = useState<SettingsState>({ status: 'loading' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch('/api/focus-flow/settings', focusSettingsSchema)
      .then((settings) => setState({ status: 'ok', settings }))
      .catch((err: unknown) =>
        setState({ status: 'error', detail: err instanceof Error ? err.message : String(err) })
      );
  }, []);

  function updateLocal(patch: Partial<FocusSettings>) {
    setState((prev) => (prev.status === 'ok' ? { status: 'ok', settings: { ...prev.settings, ...patch } } : prev));
    setSaved(false);
  }

  async function onSave() {
    if (state.status !== 'ok') return;
    setSaving(true);
    try {
      const body: UpdateFocusSettingsRequest = {
        focusMinutes: state.settings.focusMinutes,
        shortBreakMinutes: state.settings.shortBreakMinutes,
        longBreakMinutes: state.settings.longBreakMinutes,
        roundsBeforeLongBreak: state.settings.roundsBeforeLongBreak,
        autoStartBreaks: state.settings.autoStartBreaks,
        autoStartFocus: state.settings.autoStartFocus,
        notificationsEnabled: state.settings.notificationsEnabled,
        projectedFocusMinutesPerDay: state.settings.projectedFocusMinutesPerDay
      };
      const updated = await apiFetch('/api/focus-flow/settings', focusSettingsSchema, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      setState({ status: 'ok', settings: updated });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function onToggleNotifications(enabled: boolean) {
    updateLocal({ notificationsEnabled: enabled });
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white">
          Configuración <span className="text-awk-cyan-400">·</span> ajusta Pomodoro y notificaciones
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">Los cambios se aplican a tu próximo ciclo.</p>
      </header>

      {state.status === 'loading' && <p className="text-awk-blue-300">Cargando…</p>}
      {state.status === 'error' && (
        <p className="text-red-400" data-testid="settings-error">
          No se pudo cargar la configuración ({state.detail}).
        </p>
      )}

      {state.status === 'ok' && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-awk-blue-800 bg-awk-navy-800 p-6">
            <h2 className="text-sm font-medium text-awk-blue-100">Temporizadores</h2>
            <p className="mb-2 text-xs text-awk-blue-400">Duración de cada fase en minutos</p>
            {STEPPERS.map((stepper) => (
              <SettingRow key={stepper.key} label={stepper.label} hint={stepper.hint}>
                <Stepper
                  value={state.settings[stepper.key]}
                  min={stepper.min}
                  max={stepper.max}
                  onChange={(value) => updateLocal({ [stepper.key]: value } as Partial<FocusSettings>)}
                  testId={stepper.key}
                />
              </SettingRow>
            ))}
          </div>

          <div className="rounded-2xl border border-awk-blue-800 bg-awk-navy-800 p-6">
            <h2 className="text-sm font-medium text-awk-blue-100">Comportamiento y notificaciones</h2>
            <p className="mb-2 text-xs text-awk-blue-400">Automatización y avisos de ciclo</p>
            <SettingRow label="Iniciar descansos automáticamente" hint="Sin pulsar iniciar">
              <Switch
                checked={state.settings.autoStartBreaks}
                onChange={(v) => updateLocal({ autoStartBreaks: v })}
                testId="auto-start-breaks"
              />
            </SettingRow>
            <SettingRow label="Iniciar pomodoro automáticamente" hint="Al terminar el descanso">
              <Switch
                checked={state.settings.autoStartFocus}
                onChange={(v) => updateLocal({ autoStartFocus: v })}
                testId="auto-start-focus"
              />
            </SettingRow>
            <SettingRow label="Notificaciones push" hint="Aviso al inicio y fin de ciclo">
              <Switch
                checked={state.settings.notificationsEnabled}
                onChange={onToggleNotifications}
                testId="notifications-enabled"
              />
            </SettingRow>

            <div className="mt-6 flex items-center gap-3">
              <Button onClick={() => void onSave()} disabled={saving} data-testid="save-settings-button">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
              {saved && <span className="text-xs text-awk-cyan-300">Guardado.</span>}
            </div>
          </div>

          <div className="rounded-2xl border border-awk-blue-800 bg-awk-navy-800 p-6 md:col-span-2">
            <h2 className="text-sm font-medium text-awk-blue-100">Meta diaria</h2>
            <p className="mb-2 text-xs text-awk-blue-400">
              Cuántas horas esperas dedicar a trabajo enfocado por día — tu propia meta personal, para comparar
              contra tus horas trabajadas en Desempeño.
            </p>
            <SettingRow label="Horas proyectadas por día" hint="En pasos de media hora">
              <HourStepper
                value={state.settings.projectedFocusMinutesPerDay}
                min={PROJECTED_FOCUS_MINUTES_MIN}
                max={PROJECTED_FOCUS_MINUTES_MAX}
                onChange={(value) => updateLocal({ projectedFocusMinutesPerDay: value })}
                testId="projectedFocusMinutesPerDay"
              />
            </SettingRow>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-awk-blue-800 py-4 last:border-none">
      <div>
        <p className="text-sm font-medium text-awk-blue-50">{label}</p>
        <p className="text-xs text-awk-blue-400">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
  testId
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-2 py-1 text-lg font-semibold text-awk-cyan-300"
        data-testid={`${testId}-decrement`}
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums text-white" data-testid={`${testId}-value`}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-2 py-1 text-lg font-semibold text-awk-cyan-300"
        data-testid={`${testId}-increment`}
      >
        +
      </button>
    </div>
  );
}

/** `600` → "10 h", `450` → "7,5 h" (coma decimal, cambio-3 spec técnica). */
function formatProjectedHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10;
  const formatted = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
  return `${formatted} h`;
}

/**
 * Igual que `Stepper`, pero pensado en horas: el valor se guarda en minutos
 * (`projectedFocusMinutesPerDay`) pero la persona piensa en horas, incluidas
 * medias horas (spec-tecnica.md change-3, gate técnico: paso de 30 minutos,
 * granularidad confirmada en el gate funcional). Reutiliza los mismos
 * `data-testid` que `Stepper` (mismo criterio de testabilidad).
 */
function HourStepper({
  value,
  min,
  max,
  onChange,
  testId
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 30))}
        className="px-2 py-1 text-lg font-semibold text-awk-cyan-300"
        data-testid={`${testId}-decrement`}
      >
        −
      </button>
      <span
        className="w-14 text-center text-sm font-semibold tabular-nums text-white"
        data-testid={`${testId}-value`}
      >
        {formatProjectedHours(value)}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 30))}
        className="px-2 py-1 text-lg font-semibold text-awk-cyan-300"
        data-testid={`${testId}-increment`}
      >
        +
      </button>
    </div>
  );
}

/**
 * Interruptor de Configuración (spec-tecnica.md `focus-flow` · change-1): el
 * thumb necesita un ancla explícita (`inset-y-1 left-1`) — sin ella,
 * `translate-x-*` parte de la posición estática implícita de un `absolute`
 * sin `left`, que no garantiza el offset que asume el cálculo, y el círculo
 * quedaba mal ubicado en ambos estados (gate funcional, cambio 1). Con el
 * ancla fija, `translate-x-0`/`translate-x-5` mueven el thumb (`h-5 w-5`,
 * 20px) exactamente entre el borde izquierdo y el derecho del track (`w-12`,
 * 48px, menos 4px de inset a cada lado: 48 − 20 − 4 − 4 = 20px = 5 unidades).
 */
function Switch({ checked, onChange, testId }: { checked: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full border border-awk-blue-700 transition-colors ${
        checked ? 'bg-awk-cyan-500' : 'bg-awk-blue-800'
      }`}
      data-testid={testId}
    >
      <span
        className={`absolute inset-y-1 left-1 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
