import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import {
  CachedRates,
  CurrencyConversionResult,
  ExchangeRatesResponse,
} from "./interfaces";
import { envs } from "src/config";

const OPEN_EXCHANGE_RATES_BASE_URL = envs.openExchangeRatesBaseUrl;
const RATES_CACHE_TTL_MS = envs.ratesCacheTtlMs; // 1 hour, matches the free plan's update frequency

/**
 * Service responsible for currency conversion using Open Exchange Rates API.
 *
 * This service provides:
 * - Real-time currency conversion between supported currencies.
 * - Internal caching layer to reduce external API calls.
 * - Support for non-USD conversions by routing through USD as base currency.
 *
 * Key design decisions:
 * - Open Exchange Rates free plan only provides USD-based rates.
 *   Therefore, all conversions between non-USD currencies are normalized
 *   through USD as an intermediate step.
 *
 * - A simple in-memory cache is used to avoid exceeding API limits
 *   and improve performance.
 */
@Injectable()
export class CurrencyService {
  private cachedRates: CachedRates | null = null;

  constructor() {}

  /**
   * Converts a monetary amount from one currency to another.
   *
   * Process:
   * 1. Normalizes currency codes to uppercase.
   * 2. Retrieves latest exchange rates (cached or remote).
   * 3. Validates that both currencies are supported.
   * 4. Computes exchange rate (direct or via USD).
   * 5. Returns the converted amount rounded to 2 decimals.
   *
   * @param amount Numeric amount to convert.
   * @param from Source currency code (e.g., USD, EUR).
   * @param to Target currency code.
   *
   * @returns Object containing:
   * - originalAmount: input amount
   * - from: source currency
   * - to: target currency
   * - convertedAmount: converted value
   * - exchangeRate: applied rate
   *
   * @throws HttpException
   * - 400 if currency is not supported.
   * - 500 if external API fails.
   */
  async convert(
    amount: number,
    from: string,
    to: string,
  ): Promise<CurrencyConversionResult> {
    const fromCode = from.toUpperCase();
    const toCode = to.toUpperCase();

    const rates = await this.getRates();

    this.assertCurrencyIsSupported(fromCode, rates);
    this.assertCurrencyIsSupported(toCode, rates);

    const exchangeRate = this.computeExchangeRate(fromCode, toCode, rates);
    const convertedAmount = amount * exchangeRate;

    return {
      originalAmount: amount,
      from: fromCode,
      to: toCode,
      convertedAmount: Math.round(convertedAmount * 100) / 100, // round to 2 decimals
      exchangeRate,
    };
  }

  /**
   * Computes exchange rate between two currencies using USD as pivot.
   *
   * Rules:
   * - USD → X: direct rate
   * - X → USD: inverse rate
   * - X → Y: (1 / rate[X]) * rate[Y]
   *
   * This is required because the API only provides USD-based rates.
   *
   * @param from Source currency code.
   * @param to Target currency code.
   * @param rates Map of USD-based exchange rates.
   *
   * @returns Exchange rate multiplier.
   */
  private computeExchangeRate(
    from: string,
    to: string,
    rates: Record<string, number>,
  ): number {
    if (from === "USD") {
      return rates[to];
    }
    if (to === "USD") {
      return 1 / rates[from];
    }
    // Neither is USD: convert from -> USD -> to
    return (1 / rates[from]) * rates[to];
  }

  /**
   * Validates that a currency code is supported by the API.
   *
   * USD is always considered valid because it is the base currency.
   *
   * @throws HttpException
   * - 400 if currency is not supported.
   */
  private assertCurrencyIsSupported(
    code: string,
    rates: Record<string, number>,
  ): void {
    if (code !== "USD" && !(code in rates)) {
      throw new HttpException(
        `Unsupported currency code: ${code}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Retrieves exchange rates using an in-memory cache.
   *
   * Cache strategy:
   * - Stores last fetched rates and timestamp.
   * - Uses TTL configured via environment variables.
   * - Prevents exceeding API rate limits (free tier restrictions).
   *
   * If cache is valid → returns cached rates.
   * If expired → fetches fresh rates from API.
   *
   * @returns Map of currency rates relative to USD.
   */
  private async getRates(): Promise<Record<string, number>> {
    const isCacheValid =
      this.cachedRates !== null &&
      Date.now() - this.cachedRates.fetchedAt < RATES_CACHE_TTL_MS;

    if (isCacheValid) {
      return this.cachedRates!.rates;
    }

    const rates = await this.fetchLatestRates();
    this.cachedRates = { rates, fetchedAt: Date.now() };
    return rates;
  }

  /**
   * Fetches latest exchange rates from Open Exchange Rates API.
   *
   * Handles:
   * - Network failures (DNS, timeout, connection errors)
   * - HTTP error responses (non-2xx)
   * - Invalid JSON responses from API
   *
   * @throws HttpException
   * - 500 if network request fails or API returns invalid data.
   */
  private async fetchLatestRates(): Promise<Record<string, number>> {
    const appId = envs.openExchangeRatesAppId;
    const url = `${OPEN_EXCHANGE_RATES_BASE_URL}?app_id=${appId}`;

    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      // Network-level failure: DNS, timeout, connection refused, etc.
      throw new HttpException(
        "Failed to fetch exchange rates",
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: error instanceof Error ? error : undefined },
      );
    }

    if (!response.ok) {
      throw new HttpException(
        "Failed to fetch exchange rates",
        HttpStatus.INTERNAL_SERVER_ERROR,
        {
          cause: new Error(
            `Open Exchange Rates request failed with status ${response.status}`,
          ),
        },
      );
    }

    try {
      const data: ExchangeRatesResponse = await response.json();
      return data.rates;
    } catch (error) {
      // Response was OK but body wasn't valid JSON — unexpected API behavior.
      throw new HttpException(
        "Failed to parse exchange rates response",
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }
}
