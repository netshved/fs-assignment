export interface EventPayload {
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
