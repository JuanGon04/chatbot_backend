import { ApiProperty } from '@nestjs/swagger';

/**
 * Result returned to the LLM after performing a currency conversion.
 */
export class CurrencyConversionResultDto {
  @ApiProperty({ example: 100 })
  originalAmount!: number;

  @ApiProperty({ example: 'USD' })
  from!: string;

  @ApiProperty({ example: 'EUR' })
  to!: string;

  @ApiProperty({ example: 92.34 })
  convertedAmount!: number;

  @ApiProperty({ example: 0.9234 })
  exchangeRate!: number;
}