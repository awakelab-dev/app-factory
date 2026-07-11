import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('combina clases', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('resuelve conflictos de Tailwind (gana la última)', () => {
    expect(cn('bg-awk-cyan-500', 'bg-awk-navy-900')).toBe('bg-awk-navy-900');
  });

  it('ignora valores falsy', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});
