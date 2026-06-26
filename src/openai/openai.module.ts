import { Global, Module } from "@nestjs/common";
import { OpenAIProvider } from "./openai.provider";

@Global()
@Module({
  providers: [OpenAIProvider],
  exports: [OpenAIProvider],
})
export class OpenAiModule {}