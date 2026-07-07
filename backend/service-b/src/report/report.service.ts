import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { MetricPoint, TelemetryService } from '@fs-assignment/common';

const GRPC_DEADLINE_MS = 15_000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface ReportGrpcClient {
  GeneratePdf: (
    request: { filter_date: string; filter_type: string; time_series_json: Buffer },
    options: { deadline: Date },
    callback: (error: grpc.ServiceError | null, response: { pdf_content: Buffer }) => void,
  ) => void;
}

@Injectable()
export class ReportService implements OnModuleInit {
  private readonly logger = new Logger(ReportService.name);
  private client!: ReportGrpcClient;

  constructor(private readonly telemetry: TelemetryService) {}

  onModuleInit() {
    const packageDefinition = protoLoader.loadSync(this.resolveProtoPath(), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const reportProto = grpc.loadPackageDefinition(packageDefinition) as grpc.GrpcObject;
    const reportPackage = reportProto.report as { ReportService: grpc.ServiceClientConstructor };
    const host = process.env.REPORT_GRPC_HOST || 'localhost';
    const port = process.env.REPORT_GRPC_PORT || '50051';
    this.client = new reportPackage.ReportService(
      `${host}:${port}`,
      grpc.credentials.createInsecure(),
    ) as unknown as ReportGrpcClient;
    this.logger.log(`Report gRPC client -> ${host}:${port}`);
  }

  /**
   * Builds a PDF for the requested day (UTC) from real time series data.
   * If metrics cannot be read, the request fails — the report never renders
   * invented numbers.
   */
  async generatePdf(date: string, type?: string): Promise<Buffer> {
    const from = Date.parse(`${date}T00:00:00.000Z`);
    if (Number.isNaN(from)) {
      throw new BadRequestException(`Invalid date: ${date}`);
    }
    const to = from + DAY_MS - 1;
    const actionFilter = type && type !== 'all' ? type : undefined;

    let points: MetricPoint[];
    try {
      points = await this.telemetry.getMetricsRange(from, to, HOUR_MS, actionFilter);
    } catch (err) {
      this.logger.error(`Metrics read failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Metrics store is unavailable, report cannot be generated');
    }

    const timeSeriesJson = Buffer.from(JSON.stringify(points));
    return new Promise((resolve, reject) => {
      this.client.GeneratePdf(
        { filter_date: date, filter_type: actionFilter ?? 'all', time_series_json: timeSeriesJson },
        { deadline: new Date(Date.now() + GRPC_DEADLINE_MS) },
        (error, response) => {
          if (error) {
            this.logger.error(`gRPC GeneratePdf failed: ${error.message}`);
            reject(new ServiceUnavailableException('PDF service is unavailable'));
          } else {
            resolve(response.pdf_content);
          }
        },
      );
    });
  }

  private resolveProtoPath(): string {
    const candidates = [
      path.join(process.cwd(), 'proto', 'report.proto'),
      path.join(process.cwd(), '..', 'proto', 'report.proto'),
      path.join(__dirname, '..', '..', 'proto', 'report.proto'),
    ];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (!found) {
      throw new Error(`report.proto not found. Checked: ${candidates.join('; ')}`);
    }
    return found;
  }
}
