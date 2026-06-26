import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import csv = require('csv-parser');
import { envs } from 'src/config';
import { Product, ProductWithEmbedding } from './interfaces';
import { ProductResultDto } from './dto';

const EMBEDDING_MODEL = envs.embeddingModel;
const TOP_N_RESULTS = envs.topNResults;

@Injectable()
export class ProductsService implements OnModuleInit {
  private readonly logger = new Logger(ProductsService.name);
  private readonly openai: OpenAI;

  // In-memory cache of products with their precomputed embeddings.
  // Populated once on module startup to avoid recomputing embeddings on every request.
  private productsWithEmbeddings: ProductWithEmbedding[] = [];

  constructor() {
    this.openai = new OpenAI({
      apiKey: envs.openaiApiKey,
    });
  }

  /**
   * Loads the product catalog and precomputes embeddings on application startup.
   */
  async onModuleInit(): Promise<void> {
    const products = await this.loadProductsFromCsv();
    this.productsWithEmbeddings = await this.computeProductEmbeddings(products);
    this.logger.log(`Indexed ${this.productsWithEmbeddings.length} products with embeddings`);
  }

  /**
   * Parses the products_list.csv file into an array of Product objects.
   */
  private loadProductsFromCsv(): Promise<Product[]> {
    const filePath = path.join(__dirname, 'data', 'products_list.csv');
    const products: Product[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => products.push(this.mapRowToProduct(row)))
        .on('end', () => resolve(products))
        .on('error', (err) => reject(err));
    });
  }

  private mapRowToProduct(row: Record<string, string>): Product {
    return {
      displayTitle: row.displayTitle,
      embeddingText: row.embeddingText,
      url: row.url,
      imageUrl: row.imageUrl,
      productType: row.productType,
      discount: row.discount === '1',
      price: row.price,
      variants: row.variants,
    };
  }

  /**
   * Calls the OpenAI Embeddings API in a single batched request to generate
   * a vector representation for every product's embeddingText field.
   */
  private async computeProductEmbeddings(products: Product[]): Promise<ProductWithEmbedding[]> {
    const input = products.map((p) => p.embeddingText);

    const response = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input,
    });

    return products.map((product, index) => ({
      ...product,
      embedding: response.data[index].embedding,
    }));
  }

  /**
   * Computes cosine similarity between two vectors of equal length.
   * Returns a value between -1 and 1, where 1 means identical direction (most similar).
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
   * Searches the product catalog for items semantically related to the user's query.
   * Uses OpenAI embeddings + cosine similarity, which allows matching across
   * languages (e.g. a Spanish query against an English catalog) without
   * relying on exact keyword overlap.
   *
   * @param query - free-text search term describing what the user is looking for
   * @returns the top matching products (max TOP_N_RESULTS)
   */
  async searchProducts(query: string): Promise<ProductResultDto[]> {
    const queryEmbeddingResponse = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
    });
    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

    const scored = this.productsWithEmbeddings.map((product) => ({
      product,
      score: this.cosineSimilarity(queryEmbedding, product.embedding),
    }));

    return scored
      .toSorted((a, b) => b.score - a.score)
      .slice(0, TOP_N_RESULTS)
      .map(({ product }) => this.toResultDto(product));

  }

  private toResultDto(product: ProductWithEmbedding): ProductResultDto {
    return {
      displayTitle: product.displayTitle,
      price: product.price,
      productType: product.productType,
      url: product.url,
      imageUrl: product.imageUrl,
    };
  }
}