import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import fastifyHelmet from "@fastify/helmet";
import { loadConfig } from "@clariodesk/config";
import { AppModule } from "./app.module.js";

/**
 * API server entrypoint (TDD §5.1). NestJS on the Fastify adapter. Does no
 * expensive work synchronously — heavy lifting is enqueued to the worker.
 */
async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 25 * 1024 * 1024 }),
  );
  app.setGlobalPrefix("api");
  const origins = config.CORS_ORIGINS
    ? config.CORS_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : false; // deny all cross-origin if not configured — production guard in loadConfig()
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  app.enableShutdownHooks();

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
  });

  // Swagger UI only in non-production environments
  if (process.env.NODE_ENV !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("ClarioDesk API")
      .setDescription("Core v1 API surface for WhatsApp group operations")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: { docExpansion: "list", deepLinking: true },
    });
  }

  await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
  console.log(`clariodesk api listening on :${config.API_PORT}`);
}

bootstrap().catch((err) => {
  console.error("api failed to start", err);
  process.exit(1);
});
