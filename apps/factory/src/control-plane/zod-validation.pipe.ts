import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

/**
 * Valida el body contra un schema Zod de @awk/types: el MISMO schema que
 * tipa la llamada en apps/web (factory-console). Copia deliberada de
 * apps/api/src/common/zod-validation.pipe.ts — la Fábrica y la Plataforma
 * son sistemas separados (D-029) y 20 líneas no justifican un paquete
 * workspace nuevo; si aparece un tercer consumidor, se extrae.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Payload inválido',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      });
    }
    return result.data;
  }
}
