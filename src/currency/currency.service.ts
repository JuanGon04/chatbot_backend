import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { CachedRates, CurrencyConversionResult, ExchangeRatesResponse } from "./interfaces";
import { envs } from "src/config";

const OPEN_EXCHANGE_RATES_BASE_URL = envs.openExchangeRatesBaseUrl;
const RATES_CACHE_TTL_MS = envs.ratesCacheTtlMs; // 1 hour, matches the free plan's update frequency

@Injectable()
export class CurrencyService {
  private cachedRates: CachedRates | null = null;

  constructor() {}

  /**
   * Converts an amount from one currency to another using the latest exchange
   * rates from Open Exchange Rates. The free plan only provides rates relative
   * to USD, so conversions between two non-USD currencies are computed by
   * routing through USD as an intermediary.
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
   * Computes the exchange rate between two currencies, routing through USD
   * since the free plan only exposes USD-based rates.
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
   * Returns cached exchange rates if still fresh, otherwise fetches new ones
   * from Open Exchange Rates. Caching avoids exceeding the free plan's
   * 1,000 requests/month limit and matches the hourly update frequency.
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
