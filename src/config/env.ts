import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().superRefine((value, ctx) => {
    try {
      const parsed = new URL(value);

      if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DATABASE_URL must use postgresql:// or postgres://"
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Invalid PostgreSQL URL. If the password contains special characters, percent-encode it before putting it in DATABASE_URL."
      });
    }
  }),
  ETHEREUM_RPC_URL: z.string().url(),
  INDEXER_NETWORK: z.string().min(1).default("sepolia"),
  INDEXER_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  INDEXER_BATCH_SIZE: z.coerce.number().int().positive().max(10_000).default(1000),
  INDEXER_CONFIRMATIONS: z.coerce.number().int().nonnegative().default(2),
  INDEXER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(12_000),
  CONTRACT_BOOTSTRAP_CONFIG: z.string().optional()
}).superRefine((value, ctx) => {
  if (value.INDEXER_ENABLED && value.ETHEREUM_RPC_URL.includes("YOUR_API_KEY")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ETHEREUM_RPC_URL"],
      message:
        "ETHEREUM_RPC_URL still contains YOUR_API_KEY. Replace it with a real Sepolia RPC URL or set INDEXER_ENABLED=false for API-only local development."
    });
  }
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return parsed.data;
}
