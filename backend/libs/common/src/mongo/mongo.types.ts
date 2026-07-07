export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';
export const LOGS_DATABASE_CONNECTION = 'LOGS_DATABASE_CONNECTION';

export interface CharacterDocument {
  externalId: number;
  name: string;
  status: string;
  species: string;
  type: string;
  gender: string;
  origin: string;
  location: string;
  image: string;
  episode: string[];
  url: string;
  createdAt: Date;
}

export interface EventLogDocument {
  eventType: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}
