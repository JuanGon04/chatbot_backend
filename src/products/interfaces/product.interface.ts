/**
 * Represents a single product loaded from the catalog CSV.
 */
export interface Product {
  displayTitle: string;
  embeddingText: string;
  url: string;
  imageUrl: string;
  productType: string;
  discount: boolean;
  price: string;
  variants: string;
}

/**
 * A product enriched with its precomputed embedding vector,
 * used internally for semantic similarity search.
 */
export interface ProductWithEmbedding extends Product {
  embedding: number[];
}


export interface ProductResult {
  displayTitle: string;
  price: string;
  productType: string;
  url: string;
  imageUrl: string;
}