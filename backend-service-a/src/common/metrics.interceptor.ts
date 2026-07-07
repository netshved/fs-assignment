import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { TelemetryService } from '@fs-assignment/common';
import { normalizeTelemetryAction } from './normalize-telemetry-action';

interface HttpRequestLike {
  method: string;
  url: string;
  path?: string;
  route?: { path: string };
}

/**
 * Records every API action as a RedisTimeSeries metric and publishes it to the
 * event stream for Service B. Both calls are fire-and-forget: telemetry must
 * never fail or slow down the request itself.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly telemetry: TelemetryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const action = normalizeTelemetryAction(request);
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.record(action, request.url, startedAt, 'success'),
        error: () => this.record(action, request.url, startedAt, 'error'),
      }),
    );
  }

  private record(action: string, url: string, startedAt: number, outcome: 'success' | 'error') {
    void this.telemetry.recordMetric(action);
    void this.telemetry.publishEvent(action, {
      path: url,
      outcome,
      durationMs: Date.now() - startedAt,
    });
  }
}
