export type SearchProductsArgs = {
  query: string;
};

export type ConvertCurrenciesArgs = {
  amount: number;
  from: string;
  to: string;
};


export type ToolHandlers = {
  searchProducts: (args: SearchProductsArgs) => Promise<any>;
  convertCurrencies: (args: ConvertCurrenciesArgs) => Promise<any>;
};