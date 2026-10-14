import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { setupApp } from './http/setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  if (config.get('NODE_ENV') !== 'production') {
    const options = new DocumentBuilder().setTitle('Pair Habits API').setDescription('Private two-person goals and rewards API').setVersion('0.1.0').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, options));
  }
  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
