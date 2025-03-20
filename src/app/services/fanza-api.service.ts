import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Manga } from '../models/manga.interface';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FanzaApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http?: HttpClient) { }

  searchManga(keyword: string, offset: number = 1): Observable<Manga[]> {
    if (!this.http) throw new Error('HttpClient is not initialized');
    return this.http.get<Manga[]>(`${this.apiUrl}/api/manga`, {
      params: {
        keyword,
        offset: offset.toString()
      }
    });
  }

  getMangaById(fanzaId: string): Observable<Manga> {
    if (!this.http) throw new Error('HttpClient is not initialized');
    return this.http.get<Manga>(`${this.apiUrl}/api/manga/${fanzaId}`);
  }

  saveManga(manga: Manga): Observable<Manga> {
    if (!this.http) throw new Error('HttpClient is not initialized');
    return this.http.post<Manga>(`${this.apiUrl}/api/manga`, manga);
  }

  updateManga(fanzaId: string, manga: Partial<Manga>): Observable<Manga> {
    if (!this.http) throw new Error('HttpClient is not initialized');
    return this.http.put<Manga>(`${this.apiUrl}/api/manga/${fanzaId}`, manga);
  }

  deleteManga(fanzaId: string): Observable<void> {
    if (!this.http) throw new Error('HttpClient is not initialized');
    return this.http.delete<void>(`${this.apiUrl}/api/manga/${fanzaId}`);
  }
} 