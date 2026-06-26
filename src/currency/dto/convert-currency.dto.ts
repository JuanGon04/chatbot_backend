import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, Length } from 'class-validator';

/**
 * Input parameters expected from the LLM's tool call for convertCurrencies.
 */
export class ConvertCurrencyDto {
  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: 'USD', description: 'ISO 4217 currency code' })
  @IsString()
  @Length(3, 3)
  from!: string;

  @ApiProperty({ example: 'EUR', description: 'ISO 4217 currency code' })
  @IsString()
  @Length(3, 3)
  to!: string;
}