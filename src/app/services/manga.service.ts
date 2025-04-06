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
   * メソッド呼び出し時に安全なカーソルオブジェクトを作成
   * @param cursor 元のカーソルオブジェクト
   * @returns 文字列のみを含む安全なカーソルオブジェクト
   */
  private createSafeCursor(cursor: PagingCursor | null): PagingCursor | null {
    if (!cursor) return null;
    
    // 必要なプロパティがない場合はnullを返す
    if (!cursor.lastId || !cursor.lastUpdatedAt) {
      console.warn('[MangaService] 不完全なカーソル情報:', cursor);
      return null;
    }
    
    try {
      // MongoDB ObjectIdの可能性があるので、プリミティブな文字列に変換
      // サーバーサイドのObjectId2エラーを回避するためのセーフティ処理
      return {
        lastId: String(cursor.lastId).replace(/ObjectId\(['"](.*)['"]\)/, '$1'),
        lastUpdatedAt: String(cursor.lastUpdatedAt)
      };
    } catch (err) {
      console.error('[MangaService] カーソル情報変換エラー:', err);
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
      
      console.log('[MangaService] 検索カーソル情報:', {
        lastIdType: typeof safeCursor.lastId,
        lastUpdatedAtType: typeof safeCursor.lastUpdatedAt,
        lastId: safeCursor.lastId,
        lastUpdatedAt: safeCursor.lastUpdatedAt
      });
    }

    console.log('[MangaService] 検索リクエスト:', { query, cursor: safeCursor, limit });
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
    
    // 安全なカーソル情報を作成
    const safeCursor = this.createSafeCursor(cursor);
    
    // カーソル情報がある場合は追加
    if (safeCursor && safeCursor.lastId && safeCursor.lastUpdatedAt) {
      // 文字列として確実に送信
      params = params
        .set('lastId', safeCursor.lastId)
        .set('lastUpdatedAt', safeCursor.lastUpdatedAt);
      
      console.log('[MangaService] レコメンドカーソル情報:', {
        lastIdType: typeof safeCursor.lastId,
        lastUpdatedAtType: typeof safeCursor.lastUpdatedAt,
        lastId: safeCursor.lastId,
        lastUpdatedAt: safeCursor.lastUpdatedAt
      });
    }
    
    console.log('[MangaService] レコメンドリクエスト:', { genres, tags, authors, excludeIds, cursor: safeCursor, limit });
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
  searchByGenre(genre: string, cursor: PagingCursor | null, limit: number = 20): Observable<PaginatedResponse<Manga>> {
    // タグ検索の場合は代替APIを使用（ObjectIdの問題を回避するため）
    if (genre) {
      console.log('[MangaService] ジャンル検索を代替APIで実行:', genre);
      return this.searchMangaWithTags(genre, cursor, limit);
    }
    
    let params = new HttpParams().set('limit', limit.toString());
    
    if (genre) {
      params = params.set('genre', genre);
    }
    
    // 安全なカーソル情報を作成
    const safeCursor = this.createSafeCursor(cursor);
    
    // カーソル情報がある場合のみパラメータを追加
    if (safeCursor && safeCursor.lastId && safeCursor.lastUpdatedAt) {
      // 型に関係なく常に文字列として扱う
      params = params.set('lastId', safeCursor.lastId);
      params = params.set('lastUpdatedAt', safeCursor.lastUpdatedAt);
      
      console.log('[MangaService] ジャンル検索カーソル情報:', {
        lastIdType: typeof safeCursor.lastId,
        lastUpdatedAtType: typeof safeCursor.lastUpdatedAt,
        lastId: safeCursor.lastId,
        lastUpdatedAt: safeCursor.lastUpdatedAt
      });
    }
    
    console.log('[MangaService] ジャンル検索リクエストパラメータ:', params.toString());
    
    return this.http.get<PaginatedResponse<Manga>>(`${this.API_BASE_URL}/api/manga/searchByGenre`, { params })
      .pipe(
        tap(response => {
          console.log('[MangaService] ジャンル検索レスポンス:', response);
        }),
        map(response => {
          // レスポンスの中身をチェック
          if (!response || !response.data) {
            console.warn('[MangaService] 不適切なレスポンス形式:', response);
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
          console.error('[MangaService] ジャンル検索エラー:', error);
          // エラーが発生した場合は代替APIを使用
          console.log('[MangaService] エラーが発生したため代替APIを使用します');
          return this.searchMangaWithTags(genre, cursor, limit);
        })
      );
  }
  
  /**
   * タグ検索のための代替メソッド
   * ObjectIdの問題を回避するため通常の検索APIを使用
   * 
   * @param tags タグ（カンマ区切り）
   * @param cursor ページングカーソル情報
   * @param limit 一度に取得する件数
   * @returns PaginatedResponse<Manga> オブジェクト
   */
  private searchMangaWithTags(tags: string, cursor: PagingCursor | null, limit: number = 20): Observable<PaginatedResponse<Manga>> {
    console.log('[MangaService] タグ検索代替APIを使用:', tags);
    
    let params = new HttpParams()
      .set('limit', limit.toString());
    
    // タグをクエリパラメータとして追加
    params = params.set('tags', tags);
    
    // 安全なカーソル情報を作成
    const safeCursor = this.createSafeCursor(cursor);
    
    // カーソル情報がある場合は追加
    if (safeCursor && safeCursor.lastId && safeCursor.lastUpdatedAt) {
      // 文字列として確実に送信
      params = params
        .set('lastId', safeCursor.lastId)
        .set('lastUpdatedAt', safeCursor.lastUpdatedAt);
      
      console.log('[MangaService] タグ検索カーソル情報:', {
        lastIdType: typeof safeCursor.lastId,
        lastUpdatedAtType: typeof safeCursor.lastUpdatedAt,
        lastId: safeCursor.lastId,
        lastUpdatedAt: safeCursor.lastUpdatedAt
      });
    }
    
    console.log('[MangaService] タグ検索APIリクエスト:', `${this.API_BASE_URL}/api/manga/search`);
    
    // 通常の検索APIを使用（ObjectId問題を回避するため）
    return this.http.get<PaginatedResponse<any>>(`${this.API_BASE_URL}/api/manga/search`, { params }).pipe(
      tap(response => {
        console.log('[MangaService] タグ検索結果受信:', response);
      }),
      map((response) => {
        if (!response || !response.data || !Array.isArray(response.data)) {
          console.warn('[MangaService] タグ検索レスポンスデータが適切な形式ではありません:', response);
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
        console.error('[MangaService] タグ検索エラー発生:', error);
        return of({
          data: [],
          nextCursor: { lastId: '', lastUpdatedAt: '' },
          hasMore: false
        });
      })
    );
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
      map(item => {
        if (!item || !item.fanzaId) {
          console.warn(`[MangaService] ID:${id}の漫画データが不完全です:`, item);
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
        console.error(`[MangaService] ID:${id}の漫画データ取得エラー:`, error);
        // エラーを再スローして上位コンポーネントで適切に処理できるようにする
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
      
      console.log('[MangaService] 複合検索カーソル情報:', {
        lastIdType: typeof safeCursor.lastId,
        lastUpdatedAtType: typeof safeCursor.lastUpdatedAt,
        lastId: safeCursor.lastId,
        lastUpdatedAt: safeCursor.lastUpdatedAt
      });
    }
    
    console.log('[MangaService] 複合検索リクエストパラメータ:', params.toString());
    
    return this.http.get<PaginatedResponse<Manga>>(`${this.API_BASE_URL}/api/manga/searchCombined`, { params })
      .pipe(
        tap(response => {
          console.log('[MangaService] 複合検索レスポンス:', response);
        }),
        map(response => {
          // レスポンスの中身をチェック
          if (!response || !response.data) {
            console.warn('[MangaService] 不適切なレスポンス形式:', response);
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
          console.error('[MangaService] 複合検索エラー:', error);
          return of({
            data: [],
            nextCursor: { lastId: '', lastUpdatedAt: '' },
            hasMore: false
          });
        })
      );
  }
}
