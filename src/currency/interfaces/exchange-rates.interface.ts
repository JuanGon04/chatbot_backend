/**
 * Shape of the response returned by Open Exchange Rates' /latest.json endpoint.
 * The free plan always returns rates relative to USD as the base currency.
 */
export interface ExchangeRatesResponse {
  disclaimer: string;
  license: string;
  timestamp: number;
  base: string; // always "USD" on the free plan
  rates: Record<string, number>; // e.g. { EUR: 0.92, GBP: 0.79, ... }
}

export interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number;
}


/**
 * Result returned to the LLM after performing a currency conversion.
 */
export interface CurrencyConversionResult {
  originalAmount: number;
  from: string;
  to: string;
  convertedAmount: number;
  exchangeRate: number;
}