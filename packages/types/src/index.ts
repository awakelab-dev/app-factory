import { z } from 'zod';

/**
 * @awk/types — contratos compartidos front↔back.
 * Cada endpoint de la API define aquí su schema Zod: un solo esquema da
 * validación runtime (API), tipos TS (web y api) y, más adelante, OpenAPI.
 */

export const helloResponseSchema = z.object({
  service: z.string(),
  message: z.string(),
  timestamp: z.iso.datetime()
});

export type HelloResponse = z.infer<typeof helloResponseSchema>;
