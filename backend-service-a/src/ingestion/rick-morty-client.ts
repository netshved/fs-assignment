import {
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';

const logger = new Logger('RickMortyClient');

export const API_BASE_URL = 'https://rickandmortyapi.com/api';
export const HTTP_TIMEOUT_MS = 15_000;
export const PAGE_DELAY_MS = 400;
export const MAX_RETRIES = 5;
export const INITIAL_BACKOFF_MS = 1_000;

export interface RickMortyCharacter {
  id: number;
  name: string;
  status?: string;
  species?: string;
  type?: string;
  gender?: string;
  origin?: { name: string };
  location?: { name: string };
  image?: string;
  episode?: string[];
  url?: string;
}

interface RickMortyResponse {
  info: { count: number; pages: number; next: string | null };
  results: RickMortyCharacter[];
}

export function retryDelayMs(attempt: number, retryAfterHeader?: string): number {
  const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1_000;
  }
  return INITIAL_BACKOFF_MS * 2 ** attempt;
}

export function toIngestionHttpError(error: unknown): HttpException {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 429) {
      return new HttpException(
        'Rick and Morty API rate limit exceeded. Wait a minute and retry.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (status && status >= 500) {
      return new ServiceUnavailableException(
        `Rick and Morty API is unavailable (HTTP ${status})`,
      );
    }
    if (error.code === 'ECONNABORTED') {
      return new ServiceUnavailableException('Rick and Morty API request timed out');
    }
    if (!error.response) {
      return new ServiceUnavailableException('Rick and Morty API is unreachable');
    }
    return new HttpException(
      `Rick and Morty API request failed (HTTP ${status ?? 'unknown'})`,
      status ?? HttpStatus.BAD_GATEWAY,
    );
  }
  if (error instanceof Error) {
    return new ServiceUnavailableException(error.message);
  }
  return new ServiceUnavailableException('Rick and Morty API request failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<RickMortyResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get<RickMortyResponse>(url, { timeout: HTTP_TIMEOUT_MS });
      return data;
    } catch (error) {
      lastError = error;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status !== 429 || attempt === MAX_RETRIES) {
        throw toIngestionHttpError(error);
      }
      const delay = retryDelayMs(attempt, axios.isAxiosError(error) ? error.response?.headers['retry-after'] : undefined);
      logger.warn(`Rate limited by Rick and Morty API, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
      await sleep(delay);
    }
  }
  throw toIngestionHttpError(lastError);
}

/** Paginates /character with polite delays and retries on HTTP 429. */
export async function fetchAllCharacters(): Promise<RickMortyCharacter[]> {
  const items: RickMortyCharacter[] = [];
  let url: string | null = `${API_BASE_URL}/character`;

  while (url) {
    const page = await fetchPage(url);
    items.push(...page.results);
    url = page.info.next;
    if (url) {
      await sleep(PAGE_DELAY_MS);
    }
  }

  return items;
}
