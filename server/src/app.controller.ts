import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipThrottle } from '@nestjs/throttler';

@Controller()
@SkipThrottle({ auth: true, data: true })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }
}
