import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { ProductsModule } from './products/products.module';
import { CurrencyModule } from './currency/currency.module';

@Module({
  imports: [ChatModule, ProductsModule, CurrencyModule],
})
export class AppModule {}
