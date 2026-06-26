import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
} from "@nestjs/common";
import OpenAI from "openai";
import * as fs from "node:fs";
import * as path from "node:path";
import csv = require("csv-parser");
import { envs } from "src/config";
import { Product, ProductResult, ProductWithEmbedding } from "./interfaces";
import { OPENAI_CLIENT } from "src/openai/openai.provider";

const EMBEDDING_MODEL = envs.embeddingModel;
const TOP_N_RESULTS = envs.topNResults;

/**
 * Service responsible for semantic product search using OpenAI embeddings.
 *
 * This service:
 * - Loads a product catalog from a CSV file at startup.
 * - Precomputes embeddings for all products to optimize search performance.
 * - Uses cosine similarity to rank products against a user query.
 * - Returns the most relevant products for AI tool-calling usage.
 *
 * Architecture decisions:
 * - Embeddings are computed once at module initialization (OnModuleInit)
 *   to avoid repeated API calls and reduce latency.
 *
 * - In-memory storage is used for fast similarity search (no database queries).
 *
 * - Semantic search enables multilingual queries without keyword matching.
 */
@Injectable()
export class ProductsService implements OnModuleInit {
  // In-memory cache of products with their precomputed embeddings.
  // Populated once on module startup to avoid recomputing embeddings on every request.
  private vectorizedProducts: ProductWithEmbedding[] = [];

  constructor(
    /**
     * OpenAI SDK client used to communicate with the Chat Completions API.
     */
    @Inject(OPENAI_CLIENT)
    private readonly openai: OpenAI,
  ) {}

  /**
   * Lifecycle hook executed once the module is initialized.
   *
   * Loads the product catalog from CSV and precomputes embeddings using OpenAI.
   *
   * This operation is expensive and should only run once at startup.
   */
  async onModuleInit(): Promise<void> {
    const products = await this.loadProductsFromCsv();
    this.vectorizedProducts = await this.computeProductEmbeddings(products);
  }

  /**
   * Loads product data from a local CSV file.
   *
   * Process:
   * - Reads CSV file using streaming (memory efficient).
   * - Maps each row into a structured Product object.
   *
   * @returns Promise resolving to an array of Product entities.
   *
   * @throws HttpException
   * - 500 if the CSV file cannot be read or parsed.
   */
  private loadProductsFromCsv(): Promise<Product[]> {
    const filePath = path.join(__dirname, "data", "products_list.csv");
    const products: Product[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => products.push(this.mapRowToProduct(row)))
        .on("end", () => resolve(products))
        .on("error", (err) => {
          reject(
            new HttpException(
              "Error loading products from CSV",
              HttpStatus.INTERNAL_SERVER_ERROR,
              { cause: err },
            ),
          );
        });
    });
  }

  /**
   * Maps a raw CSV row into a structured Product object.
   *
   * This isolates transformation logic to ensure consistency
   * between raw input and internal domain model.
   *
   * @param row Raw CSV row
   * @returns Normalized Product object
   */
  private mapRowToProduct(row: Record<string, string>): Product {
    return {
      displayTitle: row.displayTitle,
      embeddingText: row.embeddingText,
      url: row.url,
      imageUrl: row.imageUrl,
      productType: row.productType,
      discount: row.discount === "1",
      price: row.price,
      variants: row.variants,
    };
  }

  /**
   * Generates embeddings for all products using OpenAI Embeddings API.
   *
   * Optimization:
   * - Uses a single batched request instead of per-product calls.
   *
   * This significantly reduces:
   * - API latency
   * - cost
   * - rate limit risk
   *
   * @param products List of products without embeddings
   * @returns Products enriched with vector embeddings
   *
   * @throws HttpException
   * - 500 if embedding generation fails
   */
  private async computeProductEmbeddings(
    products: Product[],
  ): Promise<ProductWithEmbedding[]> {
    try {
      const input = products.map((p) => p.embeddingText);

      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input,
      });

      return products.map((product, index) => ({
        ...product,
        embedding: response.data[index].embedding,
      }));
    } catch (error) {
      throw new HttpException(
        "Error computing product embeddings",
        HttpStatus.INTERNAL_SERVER_ERROR,
        {
          cause: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Computes cosine similarity between two vectors.
   *
   * Result interpretation:
   * - 1.0 → identical vectors (high similarity)
   * - 0.0 → unrelated
   * - -1.0 → opposite direction (rare in embeddings)
   *
   * Used as the ranking function for semantic search.
   *
   * @param a First embedding vector
   * @param b Second embedding vector
   * @returns similarity score between -1 and 1
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Performs semantic search over the product catalog using embeddings.
   *
   * Process:
   * 1. Generates embedding for the user query.
   * 2. Compares query embedding with all product embeddings.
   * 3. Computes cosine similarity scores.
   * 4. Sorts results by relevance.
   * 5. Returns top N most relevant products.
   *
   * Key feature:
   * - Supports multilingual queries (no keyword dependency).
   * - Uses semantic similarity instead of exact matching.
   *
   * @param query Natural language search query
   * @returns List of top matching products (limited by TOP_N_RESULTS)
   *
   * @throws HttpException
   * - 500 if embedding generation or search fails
   */
  async semanticSearchProducts(query: string): Promise<ProductResult[]> {
    try {
      const queryEmbeddingResponse = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: query,
      });
      const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

      const scored = this.vectorizedProducts.map((product) => ({
        product,
        score: this.cosineSimilarity(queryEmbedding, product.embedding),
      }));

      return scored
        .toSorted((a, b) => b.score - a.score)
        .slice(0, TOP_N_RESULTS)
        .map(({ product }) => this.toResult(product));
    } catch (error) {
      throw new HttpException(
        "Error searching products",
        HttpStatus.INTERNAL_SERVER_ERROR,
        {
          cause: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Maps internal ProductWithEmbedding entity to ProductResult.
   *
   * This ensures:
   * - Embeddings are never exposed externally
   * - API response remains lightweight and stable
   *
   * @param product Internal product entity
   * @returns Sanitized product response for client/LLM
   */
  private toResult(product: ProductWithEmbedding): ProductResult {
    return {
      displayTitle: product.displayTitle,
      price: product.price,
      productType: product.productType,
      url: product.url,
      imageUrl: product.imageUrl,
    };
  }
}
