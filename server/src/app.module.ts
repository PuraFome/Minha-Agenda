import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';
import { HeroModule } from './hero/hero.module';
import { MissionsModule } from './missions/missions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'auth',
        ttl: 60000,
        limit: 10,
        getTracker: (req) => req.ip,
      },
      {
        name: 'data',
        ttl: 60000,
        limit: 60,
        getTracker: (req) => req.session?.user?.sub ?? req.ip,
      },
    ]),
    DatabaseModule,
    AuthModule,
    SettingsModule,
    HeroModule,
    MissionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
