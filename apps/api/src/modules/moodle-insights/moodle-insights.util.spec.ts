import { describe, expect, it } from 'vitest';
import { average, moodleBoolean, moodleDate } from './moodle-insights.util';

describe('average', () => {
  it('ignora nulls y undefined', () => {
    expect(average([8, null, 6, undefined])).toBe(7);
  });

  it('devuelve null si no hay ninguna nota', () => {
    expect(average([null, undefined])).toBeNull();
  });

  it('devuelve null con lista vacía', () => {
    expect(average([])).toBeNull();
  });
});

describe('moodleBoolean', () => {
  it('mapea 1 a true y 0 a false', () => {
    expect(moodleBoolean(1)).toBe(true);
    expect(moodleBoolean(0)).toBe(false);
  });
});

describe('moodleDate', () => {
  it('convierte epoch en segundos a Date', () => {
    expect(moodleDate(1700000000)?.toISOString()).toBe('2023-11-14T22:13:20.000Z');
  });

  it('epoch 0 (sin fecha en Moodle) es null', () => {
    expect(moodleDate(0)).toBeNull();
  });
});
