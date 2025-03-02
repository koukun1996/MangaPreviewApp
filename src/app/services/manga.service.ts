import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Manga } from '../models/manga.interface';
import { environment } from '../../environments/environment';
import { makeStateKey, TransferState } from '@angular/platform-browser';

const MANGA_KEY = makeStateKey<Manga[]>('manga-list');

@Injectable({
  providedIn: 'root'
})
export class MangaService {
  private readonly API_BASE_URL = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private transferState: TransferState
  ) {}

  /**
   * 漫画検索APIを呼び出します。
   *
   * @param keyword 検索キーワード（初期値は空文字）
   * @param offset  ページオフセット（初期値は 1）
   * @param direction ページ送りの方向（'next' または 'prev'、任意）
   * @returns Manga オブジェクトの配列（各 Manga に offset プロパティを付与）
   */
  searchManga(keyword: string = '', offset: number = 1, direction?: string): Observable<Manga[]> {
    let params = new HttpParams().set('offset', offset.toString());
    
    // キーワードが空でない場合のみパラメータに追加
    if (keyword && keyword.trim() !== '') {
      params = params.set('keyword', keyword);
    }
    
    if (direction) {
      params = params.set('direction', direction);
    }

    console.log('[MangaService] API呼び出しパラメータ:', params.toString());

    // Check if we have data in TransferState
    const existingData = this.transferState.get(MANGA_KEY, null);
    if (existingData) {
      // If we have data in TransferState, use it and remove it
      console.log('[MangaService] TransferStateからデータを読み込み:', existingData);
      this.transferState.remove(MANGA_KEY);
      return of(existingData);
    }

    console.log('[MangaService] APIリクエスト:', `${this.API_BASE_URL}/api/manga`, params.toString());
    
    return this.http.get<Manga[]>(`${this.API_BASE_URL}/api/manga`, { params }).pipe(
      tap(data => {
        console.log('[MangaService] APIレスポンス受信:', data);
        // Store the data in TransferState if we're on the server
        if (typeof window === 'undefined') {
          console.log('[MangaService] データをTransferStateに格納');
          this.transferState.set(MANGA_KEY, data);
        }
      }),
      map((res: Manga[]) => {
        // サーバーから直接 Manga[] の形式で返ってくることを前提とする
        if (!res || !Array.isArray(res)) {
          console.warn('[MangaService] レスポンスが配列ではありません:', res);
          return [];
        }
        // サーバーのレスポンスのキー名に合わせてマッピングする
        console.log('[MangaService] レスポンスを変換:', res);
        return res.map((item: any) => {
          return {
            title: item.title,
            imageUrl: item.imageUrl || "",           // 小文字の "imageUrl" を使用
            affiliateUrl: item.affiliateUrl || "",   // 小文字の "affiliateUrl" を使用
            contentId: item.contentId || "",         // "contentId" (アンダースコアなし) を使用
            sampleImageUrls: item.sampleImageUrls || [],
            tachiyomiUrl: item.tachiyomiUrl || "",
            offset: item.offset                        // サーバーから返ってきた offset をそのまま利用
          } as Manga;
        });
      }),
      tap(data => {
        console.log('[MangaService] 変換後のデータ:', data);
      }),
      catchError(error => {
        console.error('[MangaService] エラー発生:', error);
        return of([]);
      })
    );
  }
}
