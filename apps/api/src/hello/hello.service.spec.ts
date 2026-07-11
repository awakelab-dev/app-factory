import { describe, expect, it } from 'vitest';
import { helloResponseSchema } from '@awk/types';
import { HelloService } from './hello.service';

describe('HelloService', () => {
  it('devuelve una respuesta que cumple el contrato compartido', () => {
    const service = new HelloService();
    const result = service.getHello();
    expect(helloResponseSchema.safeParse(result).success).toBe(true);
    expect(result.service).toBe('awk-api');
  });
});
