import { Controller, Get } from '@nestjs/common';
import type { HelloResponse } from '@awk/types';
import { HelloService } from './hello.service';

@Controller('hello')
export class HelloController {
  constructor(private readonly helloService: HelloService) {}

  @Get()
  getHello(): HelloResponse {
    return this.helloService.getHello();
  }
}
