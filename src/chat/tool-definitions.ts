import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'searchProducts',
      description:
        'Searches the product catalog for items related to the user query.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search term describing what the user is looking for.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'convertCurrencies',
      description:
        'Converts an amount from one currency to another using current exchange rates.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'The amount to convert.' },
          from: { type: 'string', description: 'The source currency code, e.g. USD.' },
          to: { type: 'string', description: 'The target currency code, e.g. EUR.' },
        },
        required: ['amount', 'from', 'to'],
      },
    },
  },
];