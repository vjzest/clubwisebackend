import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ENV } from './utils/config/env.config';
import { printWithBorder } from './utils/text';
import morgan from 'morgan';
import { json, urlencoded } from 'express';
import * as compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(compression());
  app.use(morgan('dev'));
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.enableCors({
    origin: true,
    credentials: true,
  });
  // app.enableCors({
  //   origin: ['https://clubwize.spaces-india.in', 'http://localhost:3000'],
  //   credentials: true,
  //   methods: '*',
  //   allowedHeaders: '*',
  // });

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Clubwize API')
    .setDescription('API documentation for Clubwize - A professional social platform for community engagement')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.use('/health', (req, res) => {
    res.send('Clubwize is up and  runnings');
  });

  await app.listen(ENV.PORT ?? 4000).then(() => {
    printWithBorder(
      'Server alive and running successfully on Port ' + ENV.PORT,
    );
  });
}
bootstrap();
