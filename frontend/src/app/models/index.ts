export interface Character {
  id: number;
  name: string;
  status: string;
  species: string;
  type: string;
  gender: string;
  origin: { name: string };
  location: { name: string };
  image: string;
  episode: string[];
  url: string;
}

export interface RickMortyResponse {
  info: {
    count: number;
    pages: number;
    next: string | null;
    prev: string | null;
  };
  results: Character[];
}

export interface Point {
  x: number;
  y: number;
}

export interface PolygonData {
  id: string;
  /** Points in relative units (0..1 of canvas size) when persisted, absolute pixels inside the engine. */
  points: Point[];
}

export interface SearchQuery {
  id: string;
  text: string;
  timestamp: number;
  resultCount: number;
}
