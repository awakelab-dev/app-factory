import { useCallback, useEffect, useRef, useState } from 'react';
import type { FocusSessionPhase, FocusSettings } from './focus-flow.types';

function nominalSeconds(mode: FocusSessionPhase, settings: FocusSettings): number {
  const minutes =
    mode === 'focus'
      ? settings.focusMinutes
      : mode === 'short_break'
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes;
  return minutes * 60;
}

export interface FocusSessionInput {
  phase: FocusSessionPhase;
  taskId: string | null;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  wasSkipped: boolean;
}

interface UseFocusTimerOptions {
  /**
   * Configuración YA cargada (spec-tecnica.md: la duración de cada fase sale
   * de `focus.settings`). El caller (`FocusPage`) solo monta este hook una
   * vez que `GET /settings` respondió — así se evita la carrera de "el
   * timer arrancó con 25:00 por defecto y luego saltó" si la persona
   * configuró otra duración.
   */
  settings: FocusSettings;
  /** Tarea "actual" (primera no completada de la cola) — quien la calcula es
   * el consumidor del hook (spec-tecnica.md: sin selección manual, pregunta 5). */
  currentTaskId: string | null;
  onSessionComplete: (input: FocusSessionInput) => void;
}

export interface UseFocusTimerResult {
  mode: FocusSessionPhase;
  remainingSeconds: number;
  totalSeconds: number;
  running: boolean;
  round: number;
  changeMode: (mode: FocusSessionPhase) => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  skipPhase: () => void;
}

/**
 * Temporizador Pomodoro (spec-tecnica.md "Temporizador — qué vive en el
 * cliente vs. qué se persiste"): el conteo del ciclo en curso vive por
 * completo aquí (setInterval de 1s) — el backend solo se entera al final de
 * cada fase vía `onSessionComplete` (el caller hace el `POST /sessions`).
 * Recargar la página a mitad de un ciclo lo pierde (gate funcional, decisión
 * 6): no hay reconstrucción de tiempo restante en este MVP.
 */
export function useFocusTimer({
  settings,
  currentTaskId,
  onSessionComplete
}: UseFocusTimerOptions): UseFocusTimerResult {
  const [mode, setMode] = useState<FocusSessionPhase>('focus');
  const [round, setRound] = useState(1);
  const [remainingSeconds, setRemainingSeconds] = useState(() => nominalSeconds('focus', settings));
  const [running, setRunning] = useState(false);

  const phaseStartedAtRef = useRef(new Date());
  const settingsRef = useRef(settings);
  const currentTaskIdRef = useRef(currentTaskId);
  const onSessionCompleteRef = useRef(onSessionComplete);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    currentTaskIdRef.current = currentTaskId;
  }, [currentTaskId]);
  useEffect(() => {
    onSessionCompleteRef.current = onSessionComplete;
  }, [onSessionComplete]);

  const changeMode = useCallback((next: FocusSessionPhase) => {
    setMode(next);
    setRunning(false);
    setRemainingSeconds(nominalSeconds(next, settingsRef.current));
    phaseStartedAtRef.current = new Date();
  }, []);

  const finishPhase = useCallback(
    (wasSkipped: boolean) => {
      const total = nominalSeconds(mode, settingsRef.current);
      const elapsed = wasSkipped ? Math.max(0, total - remainingSeconds) : total;

      onSessionCompleteRef.current({
        phase: mode,
        taskId: mode === 'focus' ? currentTaskIdRef.current : null,
        startedAt: phaseStartedAtRef.current.toISOString(),
        completedAt: new Date().toISOString(),
        durationSeconds: elapsed,
        wasSkipped
      });

      const s = settingsRef.current;
      let nextMode: FocusSessionPhase;
      let nextRound = round;
      if (mode === 'focus') {
        nextMode = round % s.roundsBeforeLongBreak === 0 ? 'long_break' : 'short_break';
      } else {
        nextMode = 'focus';
        nextRound = mode === 'long_break' ? 1 : round + 1;
      }

      setRound(nextRound);
      setMode(nextMode);
      setRemainingSeconds(nominalSeconds(nextMode, s));
      phaseStartedAtRef.current = new Date();

      // Autoarranque de fases (gate funcional, decisión 3 — implementado de
      // verdad): se lee el setting recién guardado y se decide si el timer
      // sigue solo o espera el clic de "Iniciar".
      const shouldAutoStart = nextMode === 'focus' ? s.autoStartFocus : s.autoStartBreaks;
      setRunning(shouldAutoStart);
    },
    [mode, remainingSeconds, round]
  );

  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  // El intervalo de arriba solo decrementa: el fin de fase se procesa aquí,
  // fuera del updater de setState, para no anidar side-effects dentro de él.
  useEffect(() => {
    if (running && remainingSeconds === 0) {
      setRunning(false);
      finishPhase(false);
    }
  }, [remainingSeconds, running, finishPhase]);

  const toggleTimer = useCallback(() => setRunning((prev) => !prev), []);

  const resetTimer = useCallback(() => {
    setRunning(false);
    setRemainingSeconds(nominalSeconds(mode, settingsRef.current));
    phaseStartedAtRef.current = new Date();
  }, [mode]);

  const skipPhase = useCallback(() => {
    setRunning(false);
    finishPhase(true);
  }, [finishPhase]);

  return {
    mode,
    remainingSeconds,
    totalSeconds: nominalSeconds(mode, settings),
    running,
    round,
    changeMode,
    toggleTimer,
    resetTimer,
    skipPhase
  };
}
