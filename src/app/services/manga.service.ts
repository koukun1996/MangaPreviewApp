import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Manga } from '../models/manga.interface';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MangaService {
  private readonly API_BASE_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

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

    return this.http.get<Manga[]>(`${this.API_BASE_URL}/api/manga/search`, { params }).pipe(
      map((res: Manga[]) => {
        // サーバーから直接 Manga[] の形式で返ってくることを前提とする
        if (!res || !Array.isArray(res)) {
          return [];
        }
        // サーバーのレスポンスのキー名に合わせてマッピングする
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
      catchError(error => {
        console.error('Error fetching manga:', error);
        return of([]);
      })
    );
  }
}
