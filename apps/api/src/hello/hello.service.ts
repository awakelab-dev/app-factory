import { Injectable } from '@nestjs/common';
import { helloResponseSchema, type HelloResponse } from '@awk/types';

@Injectable()
export class HelloService {
  getHello(): HelloResponse {
    // parse() garantiza en runtime que la API cumple el contrato compartido:
    // si esta respuesta dejara de ajustarse al schema, fallaría aquí (y en tests),
    // no en el navegador del usuario.
    return helloResponseSchema.parse({
      service: 'awk-api',
      message: 'Hola desde la plataforma Awakelab — contrato tipado end-to-end.',
      timestamp: new Date().toISOString()
    } satisfies HelloResponse);
  }
}
