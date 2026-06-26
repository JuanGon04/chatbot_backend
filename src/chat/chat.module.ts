import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { CurrencyModule } from 'src/currency/currency.module';
import { ProductsModule } from 'src/products/products.module';

@Module({
  imports: [ProductsModule, CurrencyModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
