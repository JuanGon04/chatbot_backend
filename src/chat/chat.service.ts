import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { TOOL_DEFINITIONS } from "./tool-definitions";
import { envs } from "src/config";
import { ProductsService } from "src/products/products.service";
import { CurrencyService } from "src/currency/currency.service";
import { ChatDto } from "./dto";

@Injectable()
export class ChatService {
  private readonly openai: OpenAI;

  constructor(
    private readonly productsService: ProductsService,
    private readonly currencyService: CurrencyService,
  ) {
    this.openai = new OpenAI({
      apiKey: envs.openaiApiKey,
    });
  }

  async handleUserMessage(userMessage: ChatDto): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: userMessage.message },
    ];

    try {
      let response = await this.openai.chat.completions.create({
        model: envs.model,
        messages,
        tools: TOOL_DEFINITIONS,
        temperature: envs.temperature,
      });

      let choice = response.choices[0];
      let rounds = 0;

      while (
        choice.finish_reason === "tool_calls" &&
        choice.message.tool_calls
      ) {
        if (++rounds > envs.maxToolRounds) {
          throw new HttpException(
            "Max tool calling rounds exceeded",
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        const toolCalls = choice.message.tool_calls;
        messages.push(choice.message);

        const toolResults = await Promise.all(
          toolCalls.map(async (toolCall) => {
            if (toolCall.type !== "function") {
              return {
                role: "tool" as const,
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  error: `Unsupported tool call type: ${toolCall.type}`,
                }),
              };
            }

            const result = await this.executeTool(
              toolCall.function.name,
              toolCall.function.arguments,
            );

            return {
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            };
          }),
        );

        messages.push(...toolResults);

        response = await this.openai.chat.completions.create({
          model: envs.model,
          messages,
          tools: TOOL_DEFINITIONS,
          temperature: envs.temperature,
        });
        choice = response.choices[0];
      }

      return choice.message.content ?? "";
    } catch (error) {
      // Re-throw HttpExceptions as-is: they're already well-formed errors
      // with the correct status code and message for the client.
      if (error instanceof HttpException) {
        throw error;
      }

      // Anything else is an unexpected failure (e.g. OpenAI API down,
      // network error, malformed response) — wrap it with a generic
      // message and preserve the real cause for logging.
      throw new HttpException(
        "Error processing chat message",
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  private async executeTool(name: string, rawArgs: string): Promise<unknown> {
    try {
      const args = JSON.parse(rawArgs);

      if (name === "searchProducts") {
        return await this.productsService.searchProducts(args.query);
      }

      if (name === "convertCurrencies") {
        return await this.currencyService.convert(
          args.amount,
          args.from,
          args.to,
        );
      }

      return { error: `Unknown tool: ${name}` };
    } catch (err) {
      return { error: `Tool execution failed: ${(err as Error).message}` };
    }
  }
}
