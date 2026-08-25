import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import session from 'express-session';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
        },
      },
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
      xContentTypeOptions: true,
      referrerPolicy: { policy: 'no-referrer' },
      xPoweredBy: true,
    }),
  );

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
      },
    }),
  );

  const frontendOrigin = process.env.FRONTEND_ORIGIN;
  if (!frontendOrigin) {
    throw new Error('FRONTEND_ORIGIN is not configured');
  }
  const corsOrigins =
    process.env.NODE_ENV === 'production'
      ? [frontendOrigin]
      : [frontendOrigin, 'http://localhost:4200'];
  app.enableCors({ origin: corsOrigins, credentials: true });

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  console.log(`listening on ${port}`);
}

bootstrap();
