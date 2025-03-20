import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MangaDocument, Manga } from '../models/manga.interface';

@Injectable({
  providedIn: 'root'
})
export class DbService {
  private readonly API_BASE_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // 漫画データを保存する
  saveManga(manga: Manga): Observable<MangaDocument> {
    const mangaDoc: MangaDocument = {
      ...manga,
      searchKeywords: this.generateKeywords(manga),
      combinations: this.generateCombinations(manga),
      lastUpdated: new Date()
    };
    
    return this.http.post<MangaDocument>(`${this.API_BASE_URL}/api/manga/save`, mangaDoc);
  }

  // キーワード検索
  searchByKeywords(keywords: string[]): Observable<MangaDocument[]> {
    return this.http.post<MangaDocument[]>(`${this.API_BASE_URL}/api/manga/search/keywords`, { keywords });
  }

  // 組み合わせ検索
  searchByCombination(combination: string[]): Observable<MangaDocument[]> {
    return this.http.post<MangaDocument[]>(`${this.API_BASE_URL}/api/manga/search/combination`, { combination });
  }

  // タグまたは作者による検索
  searchByTagsOrAuthor(query: string): Observable<MangaDocument[]> {
    return this.http.get<MangaDocument[]>(`${this.API_BASE_URL}/api/manga/search`, {
      params: { query }
    });
  }

  // 組み合わせリストを取得
  getCombinations(): Observable<string[][]> {
    return this.http.get<string[][]>(`${this.API_BASE_URL}/api/manga/combinations`);
  }

  // 人気の組み合わせを取得
  getPopularCombinations(limit: number = 10): Observable<{combination: string[], count: number}[]> {
    return this.http.get<{combination: string[], count: number}[]>(
      `${this.API_BASE_URL}/api/manga/combinations/popular`, 
      { params: { limit: limit.toString() } }
    );
  }

  // 検索キーワードを生成
  private generateKeywords(manga: Manga): string[] {
    const keywords = new Set<string>();
    
    // タイトルを分割して追加
    manga.title.split(/\s+/).forEach(word => keywords.add(word.toLowerCase()));
    
    // 作者を追加
    keywords.add(manga.author.toLowerCase());
    
    // タグを追加
    manga.tags.forEach(tag => keywords.add(tag.toLowerCase()));
    
    return Array.from(keywords);
  }

  // 組み合わせを生成
  private generateCombinations(manga: Manga): string[][] {
    const result: string[][] = [];
    
    // 作者とタグの組み合わせ
    manga.tags.forEach(tag => {
      result.push([manga.author, tag]);
      
      // タグ同士の組み合わせ（2つずつ）
      manga.tags.forEach(secondTag => {
        if (tag !== secondTag) {
          result.push([tag, secondTag]);
        }
      });
    });
    
    return result;
  }
} 