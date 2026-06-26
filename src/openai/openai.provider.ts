import OpenAI from "openai";
import { envs } from "src/config";

export const OPENAI_CLIENT = Symbol("OPENAI_CLIENT");

export const OpenAIProvider = {
  provide: OPENAI_CLIENT,
  useFactory: () => {
    return new OpenAI({
      apiKey: envs.openaiApiKey,
    });
  },
};