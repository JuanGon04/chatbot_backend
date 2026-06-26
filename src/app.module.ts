import { Module } from "@nestjs/common";
import { ChatModule } from "./chat/chat.module";
import { ProductsModule } from "./products/products.module";
import { CurrencyModule } from "./currency/currency.module";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { envs } from "./config";
import { APP_GUARD } from "@nestjs/core";

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: envs.throttleTtlMs,
          limit: envs.throttleLimit,
        },
      ],
    }),
    ChatModule,
    ProductsModule,
    CurrencyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // global guard for rate limiting
    },
  ],
})
export class AppModule {}
