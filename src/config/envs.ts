import "dotenv/config";
import * as joi from "joi";

interface EnvVars {
  PORT: number;
  OPENAI_API_KEY: string;
  ENVIRONMENT: string;
  ORIGINS_DEV: string[];
  ORIGINS_PROD: string[];

  // Configuración chat.completions.create
  MAX_TOOL_ROUNDS: number;
  TEMPERATURE: number;
  MODEL: string;

  //Configuración embeddings.create
  EMBEDDING_MODEL: string;
  TOP_N_RESULTS: number;

  ///Currency API configuration
  OPEN_EXCHANGE_RATES_APP_ID: string;
  OPEN_EXCHANGE_RATES_BASE_URL: string;
  RATES_CACHE_TTL_MS: number;

  // Rate limiting
  THROTTLE_TTL_MS: number;
  THROTTLE_LIMIT: number;
}

const envSchema = joi
  .object({
    PORT: joi.number().required(),
    OPENAI_API_KEY: joi.string().required(),
    ENVIRONMENT: joi.string().required(),
    ORIGINS_DEV: joi.array().items(joi.string()).optional(),
    ORIGINS_PROD: joi.array().items(joi.string()).optional(),
    MAX_TOOL_ROUNDS: joi.number().optional(),
    TEMPERATURE: joi.number().optional(),
    MODEL: joi.string().optional(),
    EMBEDDING_MODEL: joi.string().optional(),
    TOP_N_RESULTS: joi.number().optional(),
    OPEN_EXCHANGE_RATES_APP_ID: joi.string().required(),
    OPEN_EXCHANGE_RATES_BASE_URL: joi.string().optional(),
    RATES_CACHE_TTL_MS: joi.number().optional(),
    THROTTLE_TTL_MS: joi.number().optional(),
    THROTTLE_LIMIT: joi.number().optional(),
  })
  .unknown(true);

const { error, value } = envSchema.validate({
  ...process.env,
  ORIGINS_DEV: process.env.ORIGINS_DEV?.split(","),
  ORIGINS_PROD: process.env.ORIGINS_PROD?.split(","),
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,
  openaiApiKey: envVars.OPENAI_API_KEY,
  environment: envVars.ENVIRONMENT,
  originsDev: envVars.ORIGINS_DEV,
  originsProd: envVars.ORIGINS_PROD,
  maxToolRounds: envVars.MAX_TOOL_ROUNDS,
  temperature: envVars.TEMPERATURE,
  model: envVars.MODEL,
  embeddingModel: envVars.EMBEDDING_MODEL,
  topNResults: envVars.TOP_N_RESULTS,
  openExchangeRatesAppId: envVars.OPEN_EXCHANGE_RATES_APP_ID,
  openExchangeRatesBaseUrl: envVars.OPEN_EXCHANGE_RATES_BASE_URL,
  ratesCacheTtlMs: envVars.RATES_CACHE_TTL_MS,
  throttleTtlMs: envVars.THROTTLE_TTL_MS,
  throttleLimit: envVars.THROTTLE_LIMIT,
};
