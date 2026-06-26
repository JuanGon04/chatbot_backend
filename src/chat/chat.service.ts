import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { TOOL_DEFINITIONS } from "./tool-definitions";
import { envs } from "src/config";
import { ProductsService } from "src/products/products.service";
import { CurrencyService } from "src/currency/currency.service";
import { ChatDto } from "./dto";

const MAX_TOOL_ROUNDS = 5;

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

  async handleUserMessage(userMessage: ChatDto) {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: userMessage.message },
    ];

    let response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: TOOL_DEFINITIONS,
      temperature: 0.3
    });
console.log("Initial response:", response);

    let choice = response.choices[0];
    let rounds = 0;

    while (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      if (++rounds > MAX_TOOL_ROUNDS) {
        throw new Error("Max tool calling rounds exceeded");
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
        model: "gpt-4o-mini",
        messages,
        tools: TOOL_DEFINITIONS,
        temperature: 0.3
      });
      choice = response.choices[0];
    }

    return choice.message.content ?? "";
  }


  private async executeTool(name: string, rawArgs: string): Promise<unknown> {
    try {
      const args = JSON.parse(rawArgs);

      if (name === "searchProducts") {
        const result = await this.productsService.searchProducts(args.query);
  console.log(`searchProducts("${args.query}") returned: ${JSON.stringify(result)}`);
  return result;
      }

      if (name === "convertCurrencies") {
        console.log("Executing convertCurrencies with args:", args);
        // return await this.currencyService.convertCurrency(
        //   args.amount,
        //   args.from,
        //   args.to,
        // );
      }

      return { error: `Unknown tool: ${name}` };
    } catch (err) {
      return { error: `Tool execution failed: ${(err as Error).message}` };
    }
  }
}
