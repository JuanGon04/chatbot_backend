<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Wizybot Chatbot Backend — Technical Test

An AI-powered chatbot backend built with NestJS that uses the OpenAI Chat
Completions API with function calling to answer customer enquiries. The
chatbot has access to two tools:

- **`searchProducts`** — searches the product catalog using OpenAI embeddings
  and cosine similarity, allowing it to match queries semantically (including
  across languages) rather than relying on exact keyword matches.
- **`convertCurrencies`** — converts an amount between two currencies using
  live exchange rates from the Open Exchange Rates API.

## Architecture

```
src/
  chat/                   # Orchestrates the conversation with the LLM
    chat.controller.ts    # POST /chat endpoint
    chat.service.ts       # Tool-calling loop (Chat Completions API)
    tool-definitions.ts   # JSON Schema definitions for both tools
    dto/                  # Request DTOs
  products/               # searchProducts tool implementation
    products.service.ts   # CSV loading + embeddings + similarity search
    data/
      products_list.csv
    dto/                  # Request DTOs
    interfaces/
  currency/               # convertCurrencies tool implementation
    currency.service.ts   # Open Exchange Rates integration + caching
    dto/                  # Request DTOs
    interfaces/
  common/
    filters/
      http-exception.filter.ts  # Global exception filter
  config/
    envs.ts               # Centralized environment variable access
```

### How a request flows

1. The client sends a user enquiry to `POST /chat`.
2. `ChatService` sends the message to OpenAI's Chat Completions API along with
   the definitions of both tools.
3. If the model decides it needs a tool, `ChatService` executes it locally
   (`ProductsService.searchProducts` or `CurrencyService.convert`) and sends
   the result back to the model.
4. This repeats until the model has enough information to produce a final,
   natural-language answer, which is returned as the response body.

## Prerequisites

- Node.js v20 or higher
- An [OpenAI API key](https://platform.openai.com/api-keys) with available
  billing/credits (the free trial credits are enough for testing)
- An [Open Exchange Rates](https://openexchangerates.org/signup) free App ID
  (no credit card required)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment variables template and fill in your own values:

   ```bash
   cp .env.example .env
   ```

3. Run the project in development mode:

   ```bash
   npm run start:dev
   ```

4. The API will be available at `http://localhost:3000/api`, and the interactive
   Swagger documentation at `http://localhost:3000/api/docs`.


## Environment variables

See [`.env.example`](./.env.example) for the full list with detailed
comments. Summary:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the server listens on | `3000` |
| `ENVIRONMENT` | Current runtime environment (`dev` or `prod`) | `dev` |
| `ORIGINS_PROD` | Allowed CORS origins when `ENVIRONMENT=prod` | `*` |
| `ORIGINS_DEV` | Allowed CORS origins when `ENVIRONMENT=dev` | `*` |
| `OPENAI_API_KEY` | Your OpenAI secret key | — |
| `MODEL` | Chat model used for tool calling | `gpt-4o-mini` |
| `TEMPERATURE` | Sampling temperature for chat completions | `0.3` |
| `MAX_TOOL_ROUNDS` | Max tool-calling rounds allowed per request | `5` |
| `EMBEDDING_MODEL` | Embedding model used for semantic product search | `text-embedding-3-small` |
| `TOP_N_RESULTS` | Max number of products returned by `searchProducts` | `2` |
| `OPEN_EXCHANGE_RATES_APP_ID` | Your Open Exchange Rates App ID | — |
| `OPEN_EXCHANGE_RATES_BASE_URL` | Base URL for the exchange rates API | `https://openexchangerates.org/api/latest.json` |
| `RATES_CACHE_TTL_MS` | How long exchange rates are cached, in ms | `3600000` (1 hour) |
| `THROTTLE_TTL_MS` | time window, in seg | `60` (1 minute) |
| `THROTTLE_LIMIT` | max requests per window per IP | `15` |

> ⚠️ In production (`ENVIRONMENT=prod`), make sure to set `ORIGINS_PROD` to
> your actual client domain(s) instead of `*`, to avoid allowing requests
> from any origin.

## Testing the endpoint

### Using cURL

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{ "message": "I am looking for a phone" }'
```

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{ "message": "Convert 100 USD to EUR" }'
```

### Using Postman / Insomnia

- Method: `POST`
- URL: `http://localhost:3000/api/chat`
- Body (JSON): `{ "message": "your enquiry here" }`

### Using Swagger

Visit `http://localhost:3000/api/docs` and use the "Try it out" button on the
`/chat` endpoint.

## Design decisions and known limitations

- **Product search uses semantic embeddings instead of keyword matching.**
  This was chosen because the product catalog is in English while customer
  enquiries may come in other languages (e.g. Spanish). Cosine similarity
  over OpenAI embeddings handles this naturally; a plain keyword search would
  not. Product embeddings are computed once on application startup and
  cached in memory, since the catalog doesn't change at runtime.
- **`searchProducts` always returns up to 2 results, ranked by similarity,
  without a similarity threshold.** During development, both a fixed and a
  relative similarity threshold were tested to filter out tangentially
  related results (e.g. headphones appearing alongside phones). However,
  cosine similarity scores for short queries against this catalog turned out
  to be tightly clustered, making any threshold unreliable — it either
  filtered out genuinely relevant items or let through irrelevant ones. The
  final approach favors recall and natural-language judgment: the LLM
  receives both candidates and is generally able to communicate (when
  needed) that a result is only tangentially related.
- **Currency conversion always routes through USD.** The Open Exchange Rates
  free plan only provides rates relative to USD as the base currency.
  Converting between two non-USD currencies is computed as
  `amount / rate(from) * rate(to)`.
- **Exchange rates are cached in memory for 1 hour**, matching the free
  plan's update frequency and helping stay within its 1,000 requests/month
  limit.
- **Tool-calling rounds are capped** (`MAX_TOOL_ROUNDS`) to prevent runaway
  loops and uncontrolled API costs if the model were to repeatedly request
  tools without ever reaching a final answer.
- **Error handling distinguishes recoverable from non-recoverable errors.**
  Business-logic errors (e.g. an unsupported currency code) are surfaced to
  the LLM as a tool result, so it can explain the issue to the user in
  natural language. Infrastructure failures (e.g. OpenAI or Open Exchange
  Rates being unavailable) are propagated as HTTP errors with a generic
  message for the client and the real cause preserved in server logs via the
  `cause` property and a global exception filter.
