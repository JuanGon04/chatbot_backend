import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { envs } from "./config";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { HttpExceptionFilter } from "./common/filters";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet — Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
      hidePoweredBy: true,
      frameguard: { action: "deny" },
      noSniff: true,
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  // CORS
  const origins =
    envs.environment === "prod" ? envs.originsProd : envs.originsDev;
  app.enableCors({
    origin: origins ?? "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization,event",
    credentials: true,
  });

  // Global prefix for all routes
  app.setGlobalPrefix("api");

  // Dtos validation
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

  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger documentation
  if (envs.environment !== "prod") {
    const config = new DocumentBuilder()
      .setTitle("Wizybot Chatbot API")
      .setDescription(
        "API endpoint that communicates with an AI chatbot capable of searching products and converting currencies via OpenAI function calling.",
      )
      .setVersion("1.0")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("/api/docs", app, document);
  }

  await app.listen(envs.port ?? 3000);
}
bootstrap();
