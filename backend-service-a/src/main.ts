import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { IngestionService } from './ingestion/ingestion.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Service A API')
    .setDescription('Data ingestion and search microservice')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Service A running on http://localhost:${port} (docs: /api/docs)`);

  // Seed in the background after a short delay so a manual fetch right after
  // startup does not race the same public API and trigger rate limits.
  setTimeout(() => {
    app
      .get(IngestionService)
      .ensureDataLoaded()
      .catch((err: Error) => logger.error(`Background seed failed: ${err.message}`));
  }, 5_000);
}

bootstrap();
