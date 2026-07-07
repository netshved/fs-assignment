import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { LogsSubscriberService } from './logs.subscriber';

@Module({
  controllers: [LogsController],
  providers: [LogsService, LogsSubscriberService],
})
export class LogsModule {}
