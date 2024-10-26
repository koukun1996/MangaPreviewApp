import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Manga } from '../models/manga.interface';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MangaService {
  private readonly API_BASE_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  searchManga(keyword: string = ''): Observable<Manga[]> {
    const params = { keyword };

    return this.http.get<Manga[]>(`${this.API_BASE_URL}/api/manga/search`, { params }).pipe(
      catchError(error => {
        console.error('Error fetching manga:', error);
        return of([]);
      })
    );
  }
}