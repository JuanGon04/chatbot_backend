import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { TOOL_DEFINITIONS } from "./tool-definitions";
import { envs } from "src/config";
import { ProductsService } from "src/products/products.service";
import { CurrencyService } from "src/currency/currency.service";
import { ChatDto } from "./dto";
import { OPENAI_CLIENT } from "src/openai/openai.provider";
import { ToolHandlers } from "./types";

@Injectable()
export class ChatService {
  private readonly toolHandlers: ToolHandlers = {
    searchProducts: (args) => this.productsService.searchProducts(args.query),

    convertCurrencies: (args) =>
      this.currencyService.convert(args.amount, args.from, args.to),
  };

  constructor(
    /**
     * OpenAI SDK client used to communicate with the Chat Completions API.
     */
    @Inject(OPENAI_CLIENT)
    private readonly openai: OpenAI,

    private readonly productsService: ProductsService,
    private readonly currencyService: CurrencyService,
  ) {}

  /**
   * Sends the current conversation to OpenAI.
   */
  private createCompletion(messages: ChatCompletionMessageParam[]) {
    return this.openai.chat.completions.create({
      model: envs.model,
      messages,
      tools: TOOL_DEFINITIONS,
      temperature: envs.temperature,
    });
  }

  async handleUserMessage(userMessage: ChatDto): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: userMessage.message },
    ];

    try {
      let response = await this.createCompletion(messages);

      let choice = response.choices[0];
      let rounds = 0;

      // Execute tools until the model produces a final response.
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

        // Preserve the assistant message so the model keeps its reasoning
        // context when tool outputs are appended.
        messages.push({
          ...choice.message,
          role: "assistant",
        });

        const toolResults = await Promise.all(
          toolCalls.map(async (toolCall) => {
            // Ignore unsupported tool call types while allowing the model
            // to recover gracefully.
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

        response = await this.createCompletion(messages);
        choice = response.choices[0];
      }

      return choice.message.content ?? "";
    } catch (error) {
      // Preserve client-facing HTTP errors.
      if (error instanceof HttpException) {
        throw error;
      }

      // Wrap unexpected infrastructure failures into a generic 500 response.
      throw new HttpException(
        "Error processing chat message",
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  private parseArguments(rawArgs: string) {
    try {
      return JSON.parse(rawArgs);
    } catch (error) {
      throw new HttpException(
        "Invalid tool arguments",
        HttpStatus.BAD_REQUEST,
        {
          cause: error instanceof Error ? error : new Error(String(error)),
        },
      );
    }
  }

 
  private async executeTool(name: string, rawArgs: string): Promise<unknown> {
    const args = this.parseArguments(rawArgs);

    try {
      const handler = this.toolHandlers[name];

      if (!handler) {
        return {
          error: `Tool not registered: ${name}`,
        };
      }

      return await handler(args);
    } catch (error) {
      // Only business-logic errors (4xx) are recoverable by the LLM —
      // it can explain them to the user in natural language.
      // Infrastructure failures (5xx, network errors) should abort
      // the request entirely, since there's nothing useful the LLM
      // can say about a downstream API being unavailable.
      if (error instanceof HttpException && error.getStatus() < 500) {
        return { error: error.message };
      }

      throw error; // 5xx and unexpected errors propagate up to handleUserMessage
    }
  }
}
