import { z } from "zod";

const csvToBigIntArray = (value: string | undefined): bigint[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => BigInt(part));
};

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  SESSION_SECRET: z.string().min(8).default("dev_insecure_session_secret"),

  DATABASE_URL: z.string().default("postgresql://app:app@localhost:5432/app"),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  ALLOWED_TELEGRAM_IDS: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_DAILY_TOKEN_CAP: z.coerce.number().int().positive().default(200000),

  TZ: z.string().default("Europe/Moscow"),
});

export type Env = z.infer<typeof EnvSchema> & {
  ALLOWED_TELEGRAM_IDS_PARSED: bigint[];
};

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const parsed = EnvSchema.parse(raw);
  return {
    ...parsed,
    ALLOWED_TELEGRAM_IDS_PARSED: csvToBigIntArray(parsed.ALLOWED_TELEGRAM_IDS),
  };
};
