import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Character } from '../../models';
import { environment } from '../../../environments/environment';

interface CharacterDocumentDto {
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
}

interface ServiceASearchResponse {
  data: CharacterDocumentDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

function mapDocument(doc: CharacterDocumentDto): Character {
  return {
    id: doc.externalId,
    name: doc.name,
    status: doc.status,
    species: doc.species,
    type: doc.type,
    gender: doc.gender,
    origin: { name: doc.origin },
    location: { name: doc.location },
    image: doc.image,
    episode: doc.episode ?? [],
    url: doc.url,
  };
}

@Injectable({ providedIn: 'root' })
export class SearchApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  searchByName(
    name: string,
    page = 1,
    limit = 20,
  ): Observable<{ results: Character[]; total: number; page: number; hasNext: boolean }> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    const trimmed = name.trim();
    if (trimmed) {
      params = params.set('q', trimmed);
    }

    return this.http.get<ServiceASearchResponse>(`${this.baseUrl}/search`, { params }).pipe(
      map((response) => ({
        results: response.data.map(mapDocument),
        total: response.meta.total,
        page: response.meta.page,
        hasNext: response.meta.hasNext,
      })),
    );
  }
}
