import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { LogsQueryDto } from './logs-query.dto';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @ApiOperation({ summary: 'Query stored event logs' })
  getLogs(@Query() query: LogsQueryDto) {
    return this.logsService.findLogs(query);
  }
}
