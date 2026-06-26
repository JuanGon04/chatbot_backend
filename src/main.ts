import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envs } from './config';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origins =
    envs.environment === "prod" ? envs.originsProd : envs.originsDev;
  app.enableCors({
    origin: origins ?? "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization,event",
    credentials: true,
  });

  // Prefijo global
  app.setGlobalPrefix("api");

  // Validación de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: () => {
        return new BadRequestException({
          message: "Datos inválidos",
          statusCode: 400,
        });
      },
    }),
  );


  await app.listen(envs.port ?? 3000);
}
bootstrap();
