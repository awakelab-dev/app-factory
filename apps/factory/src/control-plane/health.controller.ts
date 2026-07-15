import { Controller, Get } from '@nestjs/common';
import { Public } from './auth.constants';

/** Healthcheck del contenedor (compose) — único endpoint sin JWT. No toca la BD. */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health(): { status: 'ok'; service: 'awk-factory' } {
    return { status: 'ok', service: 'awk-factory' };
  }
}
