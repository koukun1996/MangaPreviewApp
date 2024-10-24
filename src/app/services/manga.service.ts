import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { ApiResponse, Manga } from '../models/manga.interface';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MangaService {
  private readonly API_BASE_URL = environment.apiUrl + '/api/manga';

  constructor(private http: HttpClient) {}

  searchManga(keyword: string = '', offset: number = 1): Observable<Manga[]> {
    const params = { keyword, offset: offset.toString() };

    return this.http.get<Manga[]>(`${this.API_BASE_URL}/search`, { params }).pipe(
      catchError(error => {
        console.error('Error fetching manga:', error);
        return of([]);
      })
    );
  }
}