import { HttpStatus } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { retryDelayMs, toIngestionHttpError } from './rick-morty-client';

describe('retryDelayMs', () => {
  it('uses Retry-After header when present', () => {
    expect(retryDelayMs(0, '30')).toBe(30_000);
  });

  it('falls back to exponential backoff', () => {
    expect(retryDelayMs(0)).toBe(1_000);
    expect(retryDelayMs(2)).toBe(4_000);
  });
});

describe('toIngestionHttpError', () => {
  it('maps HTTP 429 to 429 Too Many Requests', () => {
    const error = new AxiosError('rate limited', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: {},
      config: {} as never,
      data: {},
    });
    const httpError = toIngestionHttpError(error);
    expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(httpError.message).toMatch(/rate limit/i);
  });

  it('maps upstream 5xx to 503', () => {
    const error = new AxiosError('server error', 'ERR_BAD_RESPONSE', undefined, undefined, {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {},
      config: {} as never,
      data: {},
    });
    expect(toIngestionHttpError(error).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('maps network failures to 503', () => {
    const error = new AxiosError('network', AxiosError.ERR_NETWORK);
    expect(toIngestionHttpError(error).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });
});

describe('fetchAllCharacters integration guard', () => {
  it('axios recognizes AxiosError shape used above', () => {
    const error = new AxiosError('rate limited');
    expect(axios.isAxiosError(error)).toBe(true);
  });
});
