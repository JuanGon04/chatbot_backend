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

/**
 * Service responsible for orchestrating conversations with the OpenAI Chat
 * Completions API.
 *
 * Responsibilities:
 * - Send the user's message to the language model.
 * - Execute tool calls requested by the model.
 * - Feed tool results back into the conversation.
 * - Return the final natural-language response.
 *
 * The service implements the OpenAI tool-calling loop, allowing the model
 * to invoke application capabilities such as product search and currency
 * conversion before generating its final answer.
 */

@Injectable()
export class ChatService {
  private readonly toolHandlers: ToolHandlers = {
    searchProducts: (args) => this.productsService.semanticSearchProducts(args.query),

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

  /**
   * Processes a user's message and returns the assistant's final response.
   *
   * The method performs the complete tool-calling workflow:
   * 1. Sends the user's prompt to OpenAI.
   * 2. Detects whether the model requests one or more tool calls.
   * 3. Executes the requested tools.
   * 4. Sends tool outputs back to the model.
   * 5. Repeats until the model returns a final response.
   *
   * A maximum number of tool execution rounds is enforced to prevent
   * infinite tool-calling loops.
   *
   * @param userMessage User message received from the API.
   * @returns Final assistant response.
   *
   * @throws HttpException
   * - 422 if the maximum number of tool-calling rounds is exceeded.
   * - 500 if an unexpected infrastructure error occurs.
   */
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

  /**
   * Parses raw JSON arguments received from the OpenAI tool-calling system.
   *
   * The OpenAI model sends tool arguments as a JSON string, which must be
   * safely parsed before being used by internal services.
   *
   * This method ensures:
   * - Strict JSON parsing of model-provided arguments.
   * - Early failure if the model generates malformed JSON.
   * - Clear error context for debugging purposes (original raw input is preserved).
   *
   * Security note:
   * Even though the input comes from the LLM, it is still treated as untrusted
   * external input and must be validated strictly.
   *
   * @param rawArgs JSON string generated by the language model tool call.
   *
   * @returns Parsed JavaScript object representing tool arguments.
   *
   * @throws HttpException
   * - 400 if the JSON is invalid or cannot be parsed.
   */
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

  /**
   * Executes a tool requested by the OpenAI model during function calling.
   *
   * This method acts as a dispatcher between the language model and internal
   * application services (e.g., products, currency conversion).
   *
   * Flow:
   * 1. Parses and validates tool arguments.
   * 2. Resolves the corresponding handler from the registry.
   * 3. Executes the business logic associated with the tool.
   * 4. Handles expected business errors gracefully (4xx).
   * 5. Propagates unexpected infrastructure errors (5xx).
   *
   * Design decision:
   * Instead of using multiple `if` statements, a dictionary-based registry
   * (`toolHandlers`) is used to improve scalability and maintainability.
   *
   * @param name Tool name requested by the model (must match TOOL_DEFINITIONS).
   * @param rawArgs JSON string containing arguments provided by the model.
   *
   * @returns Result returned by the tool, or a structured error object
   *          that can be interpreted by the language model.
   *
   * @throws HttpException
   * - 400 if the tool is not registered.
   * - 500 if an unexpected infrastructure error occurs.
   * - Re-throws unexpected runtime exceptions from underlying services.
   */
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
      // Business errors are considered recoverable by the language model.
      if (error instanceof HttpException && error.getStatus() < 500) {
        return { error: error.message };
      }

      throw error; // 5xx and unexpected errors propagate up to handleUserMessage
    }
  }
}