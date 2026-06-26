import type { ChatCompletionTool } from "openai/resources/chat/completions";

/**
 * Tool definitions used by OpenAI function-calling system.
 *
 * This configuration defines the interface between the language model
 * and backend services, allowing the model to invoke deterministic
 * application functions.
 *
 * Each tool acts as a contract that specifies:
 * - Tool name (must match backend handler)
 * - Description (used by the model to decide when to call it)
 * - Input schema (JSON Schema validated by OpenAI runtime)
 *
 * Design principle:
 * - Tools must be deterministic and side-effect free when possible.
 * - Input schemas must be strict to avoid hallucinated arguments.
 */
export const TOOL_DEFINITIONS: ChatCompletionTool[] = [
  /**
   * Tool: searchProducts
   *
   * Purpose:
   * Allows the model to search the product catalog using semantic search.
   *
   * When to use:
   * - User asks for products
   * - User describes needs, preferences, or features
   * - User uses natural language instead of exact keywords
   *
   * Input schema:
   * - query: string representing what the user is looking for
   *
   * Output:
   * - List of products ranked by semantic similarity
   */
  {
    type: "function",
    function: {
      name: "searchProducts",
      description:
        "Searches the product catalog for items related to the user query.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search term describing what the user is looking for.",
          },
        },
        required: ["query"],
      },
    },
  },

  /**
   * Tool: convertCurrencies
   *
   * Purpose:
   * Converts monetary values between currencies using real-time exchange rates.
   *
   * When to use:
   * - User asks for price conversions
   * - User compares prices between currencies
   * - User requests currency equivalence
   *
   * Input schema:
   * - amount: number to convert
   * - from: source currency code (e.g., USD)
   * - to: target currency code (e.g., EUR)
   *
   * Output:
   * - Converted amount + exchange rate metadata
   */
  {
    type: "function",
    function: {
      name: "convertCurrencies",
      description:
        "Converts an amount from one currency to another using current exchange rates.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "The amount to convert." },
          from: {
            type: "string",
            description: "The source currency code, e.g. USD.",
          },
          to: {
            type: "string",
            description: "The target currency code, e.g. EUR.",
          },
        },
        required: ["amount", "from", "to"],
      },
    },
  },
];
