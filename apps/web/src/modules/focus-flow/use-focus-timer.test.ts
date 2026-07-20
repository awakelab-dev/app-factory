import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FocusSettings } from './focus-flow.types';
import {
  useFocusTimer,
  type FocusSessionInput,
  type FocusTimerInitialState,
  type FocusTimerStateChange
} from './use-focus-timer';

const baseSettings: FocusSettings = {
  id: 's-1',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  notificationsEnabled: true,
  projectedFocusMinutesPerDay: 600,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z'
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(
  settings: FocusSettings = baseSettings,
  opts?: { initialState?: FocusTimerInitialState | null }
) {
  const onSessionComplete = vi.fn<(input: FocusSessionInput) => void>();
  const onStateChange = vi.fn<(change: FocusTimerStateChange) => void>();
  const { result, rerender } = renderHook(
    (props: { settings: FocusSettings; currentTaskId: string | null }) =>
      useFocusTimer({ ...props, onSessionComplete, onStateChange, initialState: opts?.initialState }),
    { initialProps: { settings, currentTaskId: 't-1' } }
  );
  return { result, rerender, onSessionComplete, onStateChange };
}

describe('useFocusTimer — estado inicial', () => {
  it('arranca en modo enfoque con la duración configurada, sin correr', () => {
    const { result } = setup();
    expect(result.current.mode).toBe('focus');
    expect(result.current.remainingSeconds).toBe(25 * 60);
    expect(result.current.running).toBe(false);
  });
});

describe('useFocusTimer — conteo', () => {
  it('toggleTimer arranca el conteo y decrementa cada segundo', () => {
    const { result } = setup();
    act(() => result.current.toggleTimer());
    expect(result.current.running).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.remainingSeconds).toBe(25 * 60 - 3);
  });

  it('al llegar a 0 naturalmente, registra la sesión completa (wasSkipped=false) y pasa a descanso corto', () => {
    const { result, onSessionComplete } = setup({ ...baseSettings, focusMinutes: 1 });
    act(() => result.current.toggleTimer());
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(onSessionComplete).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'focus', wasSkipped: false, durationSeconds: 60, taskId: 't-1' })
    );
    expect(result.current.mode).toBe('short_break');
    expect(result.current.running).toBe(false); // autoStartBreaks: false
  });
});

describe('useFocusTimer — saltar fase', () => {
  it('skipPhase registra solo el tiempo transcurrido (wasSkipped=true)', () => {
    const { result, onSessionComplete } = setup({ ...baseSettings, focusMinutes: 1 });
    act(() => result.current.toggleTimer());
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    act(() => result.current.skipPhase());

    expect(onSessionComplete).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'focus', wasSkipped: true, durationSeconds: 20 })
    );
    expect(result.current.mode).toBe('short_break');
  });

  it('saltar un descanso no manda taskId (nunca se acredita a una tarea)', () => {
    const { result, onSessionComplete } = setup({ ...baseSettings, focusMinutes: 1, shortBreakMinutes: 1 });
    act(() => result.current.toggleTimer());
    act(() => vi.advanceTimersByTime(60_000)); // termina foco → pasa a descanso corto
    act(() => result.current.skipPhase()); // salta el descanso

    const breakCall = onSessionComplete.mock.calls.find((call) => call[0].phase === 'short_break');
    expect(breakCall?.[0].taskId).toBeNull();
  });
});

describe('useFocusTimer — autoarranque (gate funcional, decisión 3)', () => {
  it('con autoStartBreaks activo, el descanso arranca solo tras completar el foco', () => {
    const { result } = setup({ ...baseSettings, focusMinutes: 1, autoStartBreaks: true });
    act(() => result.current.toggleTimer());
    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current.mode).toBe('short_break');
    expect(result.current.running).toBe(true);
  });

  it('con autoStartFocus desactivado (default), el foco NO arranca solo tras el descanso', () => {
    const { result } = setup({ ...baseSettings, focusMinutes: 1, shortBreakMinutes: 1, autoStartBreaks: true });
    act(() => result.current.toggleTimer());
    act(() => vi.advanceTimersByTime(60_000)); // foco → descanso corto (autoStartBreaks)
    act(() => vi.advanceTimersByTime(60_000)); // descanso corto termina solo

    expect(result.current.mode).toBe('focus');
    expect(result.current.running).toBe(false);
  });
});

describe('useFocusTimer — cambio manual de modo', () => {
  it('changeMode resetea el reloj sin registrar ninguna sesión', () => {
    const { result, onSessionComplete } = setup();
    act(() => result.current.changeMode('long_break'));

    expect(result.current.mode).toBe('long_break');
    expect(result.current.remainingSeconds).toBe(15 * 60);
    expect(result.current.running).toBe(false);
    expect(onSessionComplete).not.toHaveBeenCalled();
  });
});

describe('useFocusTimer — hidratación desde initialState (change-2)', () => {
  it('arranca en el estado persistido en vez de foco/25:00 por defecto', () => {
    const { result } = setup(baseSettings, {
      initialState: { phase: 'short_break', round: 3, remainingSeconds: 120, running: true }
    });

    expect(result.current.mode).toBe('short_break');
    expect(result.current.round).toBe(3);
    expect(result.current.remainingSeconds).toBe(120);
    expect(result.current.running).toBe(true);
  });

  it('sin initialState, arranca en foco/25:00 sin correr (comportamiento previo sin cambios)', () => {
    const { result } = setup();

    expect(result.current.mode).toBe('focus');
    expect(result.current.round).toBe(1);
    expect(result.current.remainingSeconds).toBe(25 * 60);
    expect(result.current.running).toBe(false);
  });
});

describe('useFocusTimer — onStateChange (change-2, simétrico a onSessionComplete)', () => {
  it('toggleTimer al iniciar emite running=true con phaseStartedAt seteado', () => {
    const { result, onStateChange } = setup();
    act(() => result.current.toggleTimer());

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'focus', round: 1, taskId: 't-1', running: true, accumulatedSeconds: 0 })
    );
    expect(onStateChange.mock.calls[0]?.[0].phaseStartedAt).not.toBeNull();
  });

  it('toggleTimer al pausar emite running=false, phaseStartedAt=null y lo transcurrido acumulado', () => {
    const { result, onStateChange } = setup();
    act(() => result.current.toggleTimer()); // Iniciar
    act(() => vi.advanceTimersByTime(5000));
    act(() => result.current.toggleTimer()); // Pausar

    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: 'focus', running: false, phaseStartedAt: null, accumulatedSeconds: 5 })
    );
  });

  it('changeMode emite el nuevo modo en pausa, sin arrastrar lo acumulado del modo anterior', () => {
    const { result, onStateChange } = setup();
    act(() => result.current.changeMode('long_break'));

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'long_break', running: false, phaseStartedAt: null, accumulatedSeconds: 0 })
    );
  });

  it('resetTimer emite el estado reiniciado en pausa desde cero', () => {
    const { result, onStateChange } = setup();
    act(() => result.current.toggleTimer());
    act(() => vi.advanceTimersByTime(10_000));
    act(() => result.current.resetTimer());

    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: 'focus', running: false, phaseStartedAt: null, accumulatedSeconds: 0 })
    );
  });

  it('al completar una fase naturalmente, emite el estado de la fase siguiente', () => {
    const { result, onStateChange } = setup({ ...baseSettings, focusMinutes: 1 });
    act(() => result.current.toggleTimer());
    act(() => vi.advanceTimersByTime(60_000));

    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: 'short_break', round: 1, running: false, accumulatedSeconds: 0 })
    );
  });
});
