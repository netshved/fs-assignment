import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportService } from './report.service';
import { ReportQueryDto } from './report-query.dto';

@ApiTags('report')
@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('pdf')
  @ApiOperation({ summary: 'Generate a PDF report with charts via the Go gRPC service' })
  async downloadPdf(@Query() query: ReportQueryDto, @Res() res: Response) {
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    const pdf = await this.reportService.generatePdf(date, query.type);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=api-report-${date}.pdf`);
    res.send(pdf);
  }
}
