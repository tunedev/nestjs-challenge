import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './app.config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import {
  LogLevel,
  NestApplicationOptions,
  ValidationPipe,
} from '@nestjs/common';

function getLogLevels(): LogLevel[] | false {
  const level = AppConfig.logLevel;

  switch (level) {
    case 'silent':
      return false;
    case 'debug':
    case 'verbose':
      return ['error', 'warn', 'log', 'debug', 'verbose'];
    case 'warn':
      return ['error', 'warn'];
    case 'error':
      return ['error'];
    case 'info':
    case 'log':
    default:
      return ['error', 'warn', 'log'];
  }
}

async function bootstrap() {
  const appOptions: NestApplicationOptions = {
    logger: getLogLevels(),
  };
  if (AppConfig.performanceDebugger) {
    appOptions.snapshot = true;
  }

  const app = await NestFactory.create(AppModule, appOptions);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Record API')
    .setDescription('The record management API')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  await app.listen(AppConfig.port);
}
bootstrap();
