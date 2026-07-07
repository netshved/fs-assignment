import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Known telemetry action labels recorded by Service A (see TelemetryInterceptor). */
export const REPORT_ACTION_TYPES = [
  'all',
  'GET /search',
  'POST /ingestion/fetch/json',
  'POST /ingestion/fetch/xlsx',
  'POST /ingestion/import/json',
  'POST /ingestion/import/xlsx',
  'POST /ingestion/upload',
] as const;

export class ReportQueryDto {
  @ApiPropertyOptional({ description: 'Report day (UTC), defaults to today', example: '2026-07-02' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;

  @ApiPropertyOptional({
    description: 'Filter by telemetry action label. Use "all" or omit for every action.',
    enum: REPORT_ACTION_TYPES,
    example: 'GET /search',
  })
  @IsOptional()
  @IsString()
  type?: string;
}
