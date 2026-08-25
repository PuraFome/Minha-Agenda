import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('me')
@SkipThrottle({ auth: true, data: true })
export class MeController {
  @Get()
  getMe(@Req() req: Request, @Res() res: Response): void {
    const user = req.session.user;
    if (!user) {
      res.status(401).send();
      return;
    }
    res.json(user);
  }
}
