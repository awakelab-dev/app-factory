import { Controller, Get } from '@nestjs/common';
import type { HelloResponse } from '@awk/types';
import { Public } from '../core/auth/auth.decorators';
import { HelloService } from './hello.service';

@Controller('hello')
export class HelloController {
  constructor(private readonly helloService: HelloService) {}

  /** Público: sirve de health-check sin credenciales. */
  @Public()
  @Get()
  getHello(): HelloResponse {
    return this.helloService.getHello();
  }
}
