import { useCallback, useEffect, useRef, useState } from 'react';
import type { FocusSessionPhase, FocusSettings } from './focus-flow.types';

/** Exportado para que `FocusPage` pueda reconstruir `remainingSeconds` a
 * partir de `GET /timer-state` (change-2) con la misma tabla de duraciones
 * que usa el propio hook. */
export function nominalSeconds(mode: FocusSessionPhase, settings: FocusSettings): number {
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

/** Estado persistido YA reconstruido (`GET /timer-state` + reloj local) que
 * hidrata el hook en vez de arrancar siempre en foco/ronda 1 (change-2). El
 * caller (`FocusPage`) ya resolvió el caso "fase vencida" (navegador cerrado
 * más tiempo del que quedaba): `remainingSeconds` viene en 0 y `running` en
 * `false` en ese caso (gate técnico change-2) — este hook no vuelve a decidir
 * eso, solo hidrata lo que recibe. */
export interface FocusTimerInitialState {
  phase: FocusSessionPhase;
  round: number;
  remainingSeconds: number;
  running: boolean;
}

/** Puntos de referencia para `PUT /timer-state` (change-2), simétrico a
 * `FocusSessionInput`/`onSessionComplete`. `phaseStartedAt` es `null` en
 * pausa (nunca se manda un "corriendo desde" falso). */
export interface FocusTimerStateChange {
  phase: FocusSessionPhase;
  round: number;
  taskId: string | null;
  phaseStartedAt: string | null;
  accumulatedSeconds: number;
  running: boolean;
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
  /** Si se pasa (usuario con `GET /timer-state` != null), hidrata el estado
   * inicial del hook en vez de arrancar siempre en
   * `nominalSeconds('focus', settings)` (change-2). `null`/`undefined` =
   * comportamiento previo sin cambios (usuario nuevo, nunca corrió un timer). */
  initialState?: FocusTimerInitialState | null;
  /** Simétrico a `onSessionComplete`: se invoca en los mismos puntos
   * discretos (play/pausa, cambio de modo, reset, fin de fase) — nunca por
   * tick — para que el caller dispare el `PUT /timer-state`
   * (fire-and-forget, best-effort, change-2). */
  onStateChange?: (change: FocusTimerStateChange) => void;
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
 *
 * Recargar la página a mitad de un ciclo ya NO lo pierde (change-2, revierte
 * la limitación de la "decisión 6" original): si el caller pasa
 * `initialState` (ya hidratado desde `GET /timer-state`), el hook arranca
 * desde ahí en vez de foco/25:00. El conteo sigue siendo enteramente del
 * cliente — esto solo cambia el punto de partida.
 */
export function useFocusTimer({
  settings,
  currentTaskId,
  onSessionComplete,
  initialState,
  onStateChange
}: UseFocusTimerOptions): UseFocusTimerResult {
  const [mode, setMode] = useState<FocusSessionPhase>(initialState?.phase ?? 'focus');
  const [round, setRound] = useState(initialState?.round ?? 1);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    initialState ? initialState.remainingSeconds : nominalSeconds('focus', settings)
  );
  const [running, setRunning] = useState(initialState?.running ?? false);

  // Aproximación del instante real en que arrancó la fase hidratada — solo
  // se usa para reportar `startedAt` de la sesión a `POST /sessions` cuando
  // la fase termine (nunca para el conteo en sí, que vive en
  // `remainingSeconds`). Sin `initialState`, es simplemente "ahora" (mismo
  // comportamiento previo).
  const phaseStartedAtRef = useRef(
    initialState
      ? new Date(Date.now() - (nominalSeconds(initialState.phase, settings) - initialState.remainingSeconds) * 1000)
      : new Date()
  );
  const settingsRef = useRef(settings);
  const currentTaskIdRef = useRef(currentTaskId);
  const roundRef = useRef(round);
  const remainingSecondsRef = useRef(remainingSeconds);
  const onSessionCompleteRef = useRef(onSessionComplete);
  const onStateChangeRef = useRef(onStateChange);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    currentTaskIdRef.current = currentTaskId;
  }, [currentTaskId]);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);
  useEffect(() => {
    onSessionCompleteRef.current = onSessionComplete;
  }, [onSessionComplete]);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  /**
   * `PUT /timer-state` (change-2, gate técnico): se invoca SOLO en los
   * eventos discretos de abajo (play/pausa, cambio de modo, reset, fin de
   * fase), nunca por tick. `phaseStartedAt` es el instante en que arrancó
   * el tramo "corriendo" actual (`null` si queda en pausa);
   * `accumulatedSeconds` es lo ya transcurrido de la fase antes de ese
   * tramo — juntos permiten reconstruir `remainingSeconds` al reabrir.
   */
  const emitStateChange = useCallback(
    (phase: FocusSessionPhase, roundValue: number, remaining: number, isRunning: boolean) => {
      if (!onStateChangeRef.current) return;
      const total = nominalSeconds(phase, settingsRef.current);
      const accumulatedSeconds = Math.max(0, total - remaining);
      onStateChangeRef.current({
        phase,
        round: roundValue,
        taskId: phase === 'focus' ? currentTaskIdRef.current : null,
        phaseStartedAt: isRunning ? new Date().toISOString() : null,
        accumulatedSeconds,
        running: isRunning
      });
    },
    []
  );

  const changeMode = useCallback(
    (next: FocusSessionPhase) => {
      setMode(next);
      setRunning(false);
      const total = nominalSeconds(next, settingsRef.current);
      setRemainingSeconds(total);
      phaseStartedAtRef.current = new Date();
      emitStateChange(next, roundRef.current, total, false);
    },
    [emitStateChange]
  );

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
      const nextTotal = nominalSeconds(nextMode, s);
      setRemainingSeconds(nextTotal);
      phaseStartedAtRef.current = new Date();

      // Autoarranque de fases (gate funcional, decisión 3 — implementado de
      // verdad): se lee el setting recién guardado y se decide si el timer
      // sigue solo o espera el clic de "Iniciar".
      const shouldAutoStart = nextMode === 'focus' ? s.autoStartFocus : s.autoStartBreaks;
      setRunning(shouldAutoStart);
      emitStateChange(nextMode, nextRound, nextTotal, shouldAutoStart);
    },
    [mode, remainingSeconds, round, emitStateChange]
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

  const toggleTimer = useCallback(() => {
    setRunning((prev) => {
      const next = !prev;
      emitStateChange(mode, roundRef.current, remainingSecondsRef.current, next);
      return next;
    });
  }, [mode, emitStateChange]);

  const resetTimer = useCallback(() => {
    setRunning(false);
    const total = nominalSeconds(mode, settingsRef.current);
    setRemainingSeconds(total);
    phaseStartedAtRef.current = new Date();
    emitStateChange(mode, roundRef.current, total, false);
  }, [mode, emitStateChange]);

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
