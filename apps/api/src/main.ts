import "./load-env";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import session from "express-session";
import { AppModule } from "./app.module";
import { validateEnv } from "./config/env.validation";

/**
 * BigInt values (Telegram user ids, stored as bigint) are not serializable by
 * JSON.stringify out of the box. Emitting them as strings keeps API responses
 * valid; the frontend treats ids as strings.
 */
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const env = validateEnv(process.env);
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Behind Caddy (TLS terminates at the proxy, which forwards plain HTTP), trust
  // the X-Forwarded-Proto header so express-session treats requests as secure and
  // actually sets the `secure` session cookie in production.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  app.use(
    session({
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 30,
      },
    }),
  );

  await app.listen(env.API_PORT);
}

void bootstrap();
