import { Injectable, Inject, Optional, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
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
  nextCursor: PagingCursor | null;
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
   * メソッド呼び出し時に安全なカーソルオブジェクトを作成
   * @param cursor 元のカーソルオブジェクト
   * @returns 文字列のみを含む安全なカーソルオブジェクト
   */
  private createSafeCursor(cursor: PagingCursor | null): PagingCursor | null {
    if (!cursor) {
      console.log('[MangaService] createSafeCursor: null cursor received');
      return null;
    }
    
    // 必要なプロパティがない場合はnullを返す
    if (!cursor.lastId || !cursor.lastUpdatedAt) {
      console.log('[MangaService] createSafeCursor: invalid cursor (missing properties)', cursor);
      return null;
    }
    
    try {
      // MongoDB ObjectIdの可能性があるので、プリミティブな文字列に変換
      // サーバーサイドのObjectId2エラーを回避するためのセーフティ処理
      const safeCursor = {
        lastId: String(cursor.lastId).replace(/ObjectId\(['"](.*)['"]\)/, '$1'),
        lastUpdatedAt: String(cursor.lastUpdatedAt)
      };
      
      console.log('[MangaService] createSafeCursor: created safe cursor', safeCursor);
      return safeCursor;
    } catch (err) {
      console.error('[MangaService] createSafeCursor: error creating safe cursor', err);
      return null;
    }
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

    // 安全なカーソル情報を作成
    const safeCursor = this.createSafeCursor(cursor);
    
    // カーソル情報がある場合は追加
    if (safeCursor && safeCursor.lastId && safeCursor.lastUpdatedAt) {
      // 文字列として確実に送信
      params = params
        .set('lastId', safeCursor.lastId)
        .set('lastUpdatedAt', safeCursor.lastUpdatedAt);
    }

    // `/api/manga/search`エンドポイントを使用
    return this.http.get<PaginatedResponse<any>>(`${this.API_BASE_URL}/api/manga/search`, { params }).pipe(
      map((response) => {
        if (!response || !response.data || !Array.isArray(response.data)) {
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

        // nextCursorも文字列型として安全に扱う
        let safeNextCursor = { lastId: '', lastUpdatedAt: '' };
        if (response.nextCursor) {
          safeNextCursor = {
            lastId: String(response.nextCursor.lastId || ''),
            lastUpdatedAt: String(response.nextCursor.lastUpdatedAt || '')
          };
        }

        return {
          data: mappedData,
          nextCursor: safeNextCursor,
          hasMore: response.hasMore || false
        };
      }),
      catchError(error => {
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
    
    // 安全なカーソル情報を作成
    const safeCursor = this.createSafeCursor(cursor);
    
    // カーソル情報がある場合は追加
    if (safeCursor && safeCursor.lastId && safeCursor.lastUpdatedAt) {
      // 文字列として確実に送信
      params = params
        .set('lastId', safeCursor.lastId)
        .set('lastUpdatedAt', safeCursor.lastUpdatedAt);
    }
    
    return this.http.get<PaginatedResponse<any>>(`${this.API_BASE_URL}/api/manga/recommendations`, { params }).pipe(
      map((response) => {
        if (!response || !response.data || !Array.isArray(response.data)) {
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

        // nextCursorも文字列型として安全に扱う
        let safeNextCursor = { lastId: '', lastUpdatedAt: '' };
        if (response.nextCursor) {
          safeNextCursor = {
            lastId: String(response.nextCursor.lastId || ''),
            lastUpdatedAt: String(response.nextCursor.lastUpdatedAt || '')
          };
        }

        return {
          data: mappedData,
          nextCursor: safeNextCursor,
          hasMore: response.hasMore || false
        };
      }),
      catchError(error => {
        return of({
          data: [],
          nextCursor: { lastId: '', lastUpdatedAt: '' },
          hasMore: false
        });
      })
    );
  }

  /**
   * ジャンルで漫画を検索
   * 
   * @param genre 検索するジャンル
   * @param cursor ページングカーソル情報
   * @param limit 一度に取得する件数
   * @returns PaginatedResponse<Manga> オブジェクト
   */
  searchByGenre(genre: string, cursor: PagingCursor | null = null, limit: number = 20): Observable<PaginatedResponse<Manga>> {
    console.log('[MangaService] searchByGenre called with genre:', genre);
    console.log('[MangaService] cursor:', cursor ? JSON.stringify(cursor) : 'null');
    console.log('[MangaService] limit:', limit);
    
    // HTTPパラメータを構築
    let params = new HttpParams()
      .set('genre', genre)
      .set('limit', limit.toString());
    
    // カーソル情報があれば追加（createSafeCursorを使わず直接文字列化）
    if (cursor) {
      if (cursor.lastId) {
        params = params.set('lastId', String(cursor.lastId));
        console.log('[MangaService] Adding lastId to params:', String(cursor.lastId));
      }
      if (cursor.lastUpdatedAt) {
        params = params.set('lastUpdatedAt', String(cursor.lastUpdatedAt));
        console.log('[MangaService] Adding lastUpdatedAt to params:', String(cursor.lastUpdatedAt));
      }
    }
    
    console.log('[MangaService] Final params for genre search:', params.toString());

    // APIリクエストを送信
    return this.http.get<PaginatedResponse<Manga>>(`${this.API_BASE_URL}/api/manga/searchByGenre`, { params })
      .pipe(
        tap(rawResponse => console.log('[MangaService] Raw genre search response:', rawResponse)),
        map(response => {
          // レスポンスからデータをマッピング
          if (!response || !response.data) {
            console.log('[MangaService] Empty response received');
            return {
              data: [],
              hasMore: false,
              nextCursor: null
            } as PaginatedResponse<Manga>;
          }
          
          // データをマッピング
          const mappedData = response.data.map((item: any) => ({
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
          
          // 次ページカーソル情報をマッピング
          let nextCursor: PagingCursor | null = null;
          if (response.nextCursor) {
            nextCursor = {
              lastId: String(response.nextCursor.lastId || ''),
              lastUpdatedAt: String(response.nextCursor.lastUpdatedAt || '')
            };
            console.log('[MangaService] Next cursor from response:', JSON.stringify(nextCursor));
          }
          
          // マッピングしたレスポンスを返す
          const mappedResponse = {
            data: mappedData,
            nextCursor: nextCursor,
            hasMore: response.hasMore || false
          };
          
          console.log('[MangaService] Genre search response mapped:', {
            dataCount: mappedResponse.data.length,
            hasNextCursor: !!mappedResponse.nextCursor,
            hasMore: mappedResponse.hasMore
          });
          
          if (mappedData.length > 0) {
            console.log('[MangaService] First manga:', mappedData[0].fanzaId);
            console.log('[MangaService] Last manga:', mappedData[mappedData.length-1].fanzaId);
          }
          
          return mappedResponse;
        }),
        catchError(error => {
          console.error('[MangaService] Genre search error:', error);
          return of({
            data: [],
            hasMore: false,
            nextCursor: null
          } as PaginatedResponse<Manga>);
        })
      );
  }

  /**
   * ジャンルと各ジャンルの作品数を取得します。
   * 
   * @returns ジャンルと作品数の配列
   */
  getGenreCounts(): Observable<{genre: string, count: number}[]> {
    return this.http.get<{genre: string, count: number}[]>(`${this.API_BASE_URL}/api/manga/genres`).pipe(
      catchError(error => {
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
    return this.http.get<Manga>(`${this.API_BASE_URL}/api/manga/${id}`).pipe(
      map(item => {
        if (!item || !item.fanzaId) {
          throw new Error('漫画データが見つかりませんでした');
        }
        return {
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
        } as Manga;
      }),
      catchError(error => {
        return throwError(() => new Error('漫画データの取得に失敗しました。サーバーが応答していないか、データが存在しません。'));
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
  searchCombined(query: string, genre: string, cursor: PagingCursor | null, limit: number = 20): Observable<PaginatedResponse<Manga>> {
    let params = new HttpParams().set('limit', limit.toString());
    
    params = params.set('query', query);
    params = params.set('genre', genre);
    
    // 安全なカーソル情報を作成
    const safeCursor = this.createSafeCursor(cursor);
    
    if (safeCursor && safeCursor.lastId && safeCursor.lastUpdatedAt) {
      // 文字列として確実に送信
      params = params.set('lastId', safeCursor.lastId);
      params = params.set('lastUpdatedAt', safeCursor.lastUpdatedAt);
    }
    
    return this.http.get<PaginatedResponse<Manga>>(`${this.API_BASE_URL}/api/manga/searchCombined`, { params })
      .pipe(
        map(response => {
          // レスポンスの中身をチェック
          if (!response || !response.data) {
            return {
              data: [],
              nextCursor: { lastId: '', lastUpdatedAt: '' },
              hasMore: false
            };
          }
          
          // データがあれば適切に変換
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

          // nextCursorを安全に処理
          let safeNextCursor = { lastId: '', lastUpdatedAt: '' };
          if (response.nextCursor) {
            safeNextCursor = {
              lastId: String(response.nextCursor.lastId || ''),
              lastUpdatedAt: String(response.nextCursor.lastUpdatedAt || '')
            };
          }
          
          return {
            data: mappedData,
            nextCursor: safeNextCursor,
            hasMore: response.hasMore || false
          };
        }),
        catchError(error => {
          return of({
            data: [],
            nextCursor: { lastId: '', lastUpdatedAt: '' },
            hasMore: false
          });
        })
      );
  }

  // レスポンスのマッピング処理を共通化
  private mapPaginatedResponse(response: any): PaginatedResponse<Manga> {
    if (!response || !response.data) {
      return {
        data: [],
        nextCursor: null,
        hasMore: false
      };
    }
    
    const mappedData = response.data.map((item: any) => ({
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
    
    let nextCursor: PagingCursor | null = null;
    if (response.nextCursor) {
      nextCursor = {
        lastId: String(response.nextCursor.lastId || ''),
        lastUpdatedAt: String(response.nextCursor.lastUpdatedAt || '')
      };
    }
    
    return {
      data: mappedData,
      nextCursor: nextCursor,
      hasMore: response.hasMore || false
    };
  }
}
