import { Injectable, Inject, Optional, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Manga } from '../models/manga.interface';
import { environment } from '../../environments/environment';
import { makeStateKey, TransferState } from '@angular/platform-browser';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { REQUEST } from '@nguniversal/express-engine/tokens';
import { Request } from 'express';

/**
 * ページングのカーソル情報を保持するインターフェース
 */
export interface PagingCursor {
  lastId?: string;
  lastUpdatedAt?: string;
}

/**
 * ページング付きのレスポンス型
 */
export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: PagingCursor;
  hasMore: boolean;
}

const MANGA_KEY = makeStateKey<Manga[]>('manga-list');

@Injectable({
  providedIn: 'root'
})
export class MangaService {
  private readonly API_BASE_URL = environment.apiUrl;
  private readonly isServer: boolean;
  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private transferState: TransferState,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Optional() @Inject(REQUEST) private request: Request
  ) {
    this.isServer = isPlatformServer(this.platformId);
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  /**
   * MongoDB内の漫画データを検索します。
   * カーソルベースのページングをサポートします。
   *
   * @param query 検索キーワード（初期値は空文字）
   * @param cursor ページングカーソル情報（初期値はnull）
   * @param limit 一度に取得する件数（初期値は20）
   * @returns PaginatedResponse<Manga> オブジェクト
   */
  searchManga(query: string = '', cursor: PagingCursor | null = null, limit: number = 20): Observable<PaginatedResponse<Manga>> {
    let params = new HttpParams()
      .set('query', query)
      .set('limit', limit.toString());

    // カーソル情報がある場合は追加
    if (cursor && cursor.lastId && cursor.lastUpdatedAt) {
      params = params
        .set('lastId', cursor.lastId)
        .set('lastUpdatedAt', cursor.lastUpdatedAt);
    }

    console.log('[MangaService] 検索リクエスト:', { query, cursor, limit });
    console.log('[MangaService] APIリクエスト:', `${this.API_BASE_URL}/api/manga/search`, params.toString());
    
    // `/api/manga/search`エンドポイントを使用
    return this.http.get<PaginatedResponse<any>>(`${this.API_BASE_URL}/api/manga/search`, { params }).pipe(
      tap(response => {
        console.log('[MangaService] APIレスポンス受信:', response);
      }),
      map((response) => {
        if (!response || !response.data || !Array.isArray(response.data)) {
          console.warn('[MangaService] レスポンスデータが適切な形式ではありません:', response);
          return {
            data: [],
            nextCursor: { lastId: '', lastUpdatedAt: '' },
            hasMore: false
          };
        }

        // データを適切な形式にマッピング
        const mappedData = response.data.map(item => ({
          fanzaId: item.fanzaId,
          title: item.title,
          author: item.author,
          price: item.price,
          thumbnailUrl: item.thumbnailUrl,
          tags: item.tags,
          description: item.description,
          affiliateUrl: item.affiliateUrl,
          tachiyomiUrl: item.tachiyomiUrl,
          sampleImageUrls: item.sampleImageUrls,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt)
        } as Manga));

        return {
          data: mappedData,
          nextCursor: response.nextCursor || { lastId: '', lastUpdatedAt: '' },
          hasMore: response.hasMore || false
        };
      }),
      tap(response => {
        console.log('[MangaService] 変換後のデータ:', response);
      }),
      catchError(error => {
        console.error('[MangaService] エラー発生:', error);
        return of({
          data: [],
          nextCursor: { lastId: '', lastUpdatedAt: '' },
          hasMore: false
        });
      })
    );
  }

  /**
   * レコメンデーションされた漫画を取得します。
   * ユーザーの好みに基づいたおすすめの漫画を返します。
   * 
   * @param genres お気に入りのジャンル（配列）
   * @param tags お気に入りのタグ（配列）
   * @param authors お気に入りの作者（配列）
   * @param excludeIds 除外するID（配列）
   * @param cursor ページングカーソル情報
   * @param limit 一度に取得する件数
   * @returns PaginatedResponse<Manga> オブジェクト
   */
  getRecommendations(
    genres: string[] = [], 
    tags: string[] = [], 
    authors: string[] = [],
    excludeIds: string[] = [],
    cursor: PagingCursor | null = null,
    limit: number = 20
  ): Observable<PaginatedResponse<Manga>> {
    let params = new HttpParams().set('limit', limit.toString());
    
    // 配列パラメータの追加
    genres.forEach(genre => {
      params = params.append('genres', genre);
    });
    
    tags.forEach(tag => {
      params = params.append('tags', tag);
    });
    
    authors.forEach(author => {
      params = params.append('authors', author);
    });
    
    excludeIds.forEach(id => {
      params = params.append('excludeIds', id);
    });
    
    // カーソル情報がある場合は追加
    if (cursor && cursor.lastId && cursor.lastUpdatedAt) {
      params = params
        .set('lastId', cursor.lastId)
        .set('lastUpdatedAt', cursor.lastUpdatedAt);
    }
    
    console.log('[MangaService] レコメンドリクエスト:', { genres, tags, authors, excludeIds, cursor, limit });
    console.log('[MangaService] APIリクエスト:', `${this.API_BASE_URL}/api/manga/recommendations`, params.toString());
    
    return this.http.get<PaginatedResponse<any>>(`${this.API_BASE_URL}/api/manga/recommendations`, { params }).pipe(
      tap(response => {
        console.log('[MangaService] レコメンドレスポンス受信:', response);
      }),
      map((response) => {
        if (!response || !response.data || !Array.isArray(response.data)) {
          console.warn('[MangaService] レスポンスデータが適切な形式ではありません:', response);
          return {
            data: [],
            nextCursor: { lastId: '', lastUpdatedAt: '' },
            hasMore: false
          };
        }

        // データを適切な形式にマッピング
        const mappedData = response.data.map(item => ({
          fanzaId: item.fanzaId,
          title: item.title,
          author: item.author,
          price: item.price,
          thumbnailUrl: item.thumbnailUrl,
          tags: item.tags,
          description: item.description,
          affiliateUrl: item.affiliateUrl,
          tachiyomiUrl: item.tachiyomiUrl,
          sampleImageUrls: item.sampleImageUrls,
          relevanceScore: item.relevanceScore,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt)
        } as Manga));

        return {
          data: mappedData,
          nextCursor: response.nextCursor || { lastId: '', lastUpdatedAt: '' },
          hasMore: response.hasMore || false
        };
      }),
      catchError(error => {
        console.error('[MangaService] レコメンドエラー発生:', error);
        return of({
          data: [],
          nextCursor: { lastId: '', lastUpdatedAt: '' },
          hasMore: false
        });
      })
    );
  }

  /**
   * 特定のジャンルに属する漫画を検索します。
   * 
   * @param genre 検索するジャンル
   * @param cursor ページングカーソル情報
   * @param limit 一度に取得する件数
   * @returns PaginatedResponse<Manga> オブジェクト
   */
  searchByGenre(genre: string, cursor: PagingCursor | null): Observable<PaginatedResponse<Manga>> {
    let params = new HttpParams();
    
    if (genre) {
      params = params.set('genre', genre);
    }
    
    if (cursor && cursor.lastId && cursor.lastUpdatedAt) {
      params = params.set('lastId', cursor.lastId);
      params = params.set('lastUpdatedAt', cursor.lastUpdatedAt);
    }
    
    return this.http.get<PaginatedResponse<Manga>>(`${this.API_BASE_URL}/api/manga/searchByGenre`, { params });
  }

  /**
   * ジャンルと各ジャンルの作品数を取得します。
   * 
   * @returns ジャンルと作品数の配列
   */
  getGenreCounts(): Observable<{genre: string, count: number}[]> {
    console.log('[MangaService] ジャンル一覧取得リクエスト');
    console.log('[MangaService] APIリクエスト:', `${this.API_BASE_URL}/api/manga/genres`);
    
    return this.http.get<{genre: string, count: number}[]>(`${this.API_BASE_URL}/api/manga/genres`).pipe(
      tap(response => {
        console.log('[MangaService] ジャンル一覧レスポンス:', response);
      }),
      catchError(error => {
        console.error('[MangaService] ジャンル一覧取得エラー:', error);
        return of([]);
      })
    );
  }

  /**
   * IDで漫画を取得する
   * 
   * @param id 漫画のID（fanzaId）
   * @returns 漫画データのObservable
   */
  getMangaById(id: string): Observable<Manga> {
    console.log(`[MangaService] ID:${id}の漫画データを取得リクエスト`);
    console.log('[MangaService] APIリクエスト:', `${this.API_BASE_URL}/api/manga/${id}`);

    return this.http.get<Manga>(`${this.API_BASE_URL}/api/manga/${id}`).pipe(
      tap(data => console.log(`[MangaService] ID:${id}の漫画データを取得:`, data)),
      map(item => ({
        fanzaId: item.fanzaId,
        title: item.title,
        author: item.author,
        price: item.price,
        thumbnailUrl: item.thumbnailUrl,
        tags: item.tags,
        description: item.description,
        affiliateUrl: item.affiliateUrl,
        tachiyomiUrl: item.tachiyomiUrl,
        sampleImageUrls: item.sampleImageUrls,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
      } as Manga)),
      catchError(error => {
        console.error(`[MangaService] ID:${id}の漫画データ取得エラー:`, error);
        return of({} as Manga);
      })
    );
  }

  /**
   * キーワードとジャンルを組み合わせた検索を実行します。
   * 
   * @param query 検索キーワード
   * @param genre ジャンル名
   * @param cursor ページングカーソル情報（初期値はnull）
   * @param limit 一度に取得する件数（初期値は20）
   * @returns PaginatedResponse<Manga> オブジェクト
   */
  searchCombined(query: string, genre: string, cursor: PagingCursor | null): Observable<PaginatedResponse<Manga>> {
    let params = new HttpParams();
    
    params = params.set('query', query);
    params = params.set('genre', genre);
    
    if (cursor && cursor.lastId && cursor.lastUpdatedAt) {
      params = params.set('lastId', cursor.lastId);
      params = params.set('lastUpdatedAt', cursor.lastUpdatedAt);
    }
    
    return this.http.get<PaginatedResponse<Manga>>(`${this.API_BASE_URL}/api/manga/searchCombined`, { params });
  }
}
