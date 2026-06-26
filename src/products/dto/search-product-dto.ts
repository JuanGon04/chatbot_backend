import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Input parameters expected from the LLM's tool call for searchProducts.
 */
export class SearchProductsDto {
  @ApiProperty({ example: 'wireless headphones' })
  @IsString()
  @IsNotEmpty()
  query!: string;
}