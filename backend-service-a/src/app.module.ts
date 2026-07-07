import { Module } from '@nestjs/common';
import { MongoModule, RedisModule } from '@fs-assignment/common';
import { IngestionModule } from './ingestion/ingestion.module';
import { SearchModule } from './search/search.module';
import { HealthController } from './health.controller';
import { MetricsInterceptor } from './common/metrics.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [MongoModule.forRoot(['main']), RedisModule, IngestionModule, SearchModule],
  controllers: [HealthController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class AppModule {}
