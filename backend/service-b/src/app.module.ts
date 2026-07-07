import { Module } from '@nestjs/common';
import { MongoModule, RedisModule } from '@fs-assignment/common';
import { LogsModule } from './logs/logs.module';
import { ReportModule } from './report/report.module';
import { HealthController } from './health.controller';

@Module({
  imports: [MongoModule.forRoot(['logs']), RedisModule, LogsModule, ReportModule],
  controllers: [HealthController],
})
export class AppModule {}
