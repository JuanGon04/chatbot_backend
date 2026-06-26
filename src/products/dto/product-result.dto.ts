import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape of a single product returned to the LLM (and ultimately to the user)
 * after a search. Excludes internal fields like the embedding vector.
 */
export class ProductResultDto {
  @ApiProperty({ example: "Sony WH-1000XM5" })
  displayTitle!: string;

  @ApiProperty({ example: '169.0 USD' })
  price!: string;

  @ApiProperty({ example: 'Technology' })
  productType!: string;

  @ApiProperty({ example: 'https://wizybot-demo-store.myshopify.com/products/sony-wh-1000xm5' })
  url!: string;

  @ApiProperty({ example: 'https://cdn.shopify.com/...' })
  imageUrl!: string;
}