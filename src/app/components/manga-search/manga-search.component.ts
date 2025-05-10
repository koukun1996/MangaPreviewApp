import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Manga } from '../../models/manga.interface';
import { MangaService, PagingCursor, PaginatedResponse } from '../../services/manga.service';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

interface GenreItem {
  genre: string;
  count: number;
  active?: boolean;
}

// 検索結果イベントの型を定義
export interface MangaSearchResultEvent {
  results: Manga[];
  searchTerm: string;
  selectedGenres: string[];
  nextCursor?: PagingCursor | null;
  hasMore?: boolean;
}

@Component({
  selector: 'app-manga-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manga-search.component.html',
  styleUrls: ['./manga-search.component.scss']
})
export class MangaSearchComponent implements OnInit {
  // 親コンポーネントから受け取るプロパティ
  @Input() isMobileDevice = false;
  
  // 検索結果を親コンポーネントに伝えるイベント
  @Output() searchResults = new EventEmitter<MangaSearchResultEvent>();
  @Output() closeSearch = new EventEmitter<void>();
  
  // 検索関連のプロパティ
  searchTerm = "";
  isGenreListVisible = false;
  genres: GenreItem[] = [];
  selectedGenres: string[] = [];
  isLoading = false;
  
  private searchSubject = new Subject<string>();
  
  constructor(private mangaService: MangaService) {
    // 検索入力の遅延処理（自動検索機能）
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(term => {
        if (term.trim() !== "") {
          // ここではキーワードを保存するだけ
          this.searchTerm = term;
        }
      });
  }

  ngOnInit(): void {
    // ジャンル一覧を取得
    this.fetchGenres();
    
    // モバイルデバイスでない場合は、ジャンルリストを表示
    this.isGenreListVisible = !this.isMobileDevice;
  }

  // ジャンル一覧を読み込む
  fetchGenres() {
    console.log('[MangaSearch] ジャンル一覧を取得中...');
    this.mangaService.getGenreCounts().subscribe({
      next: (genreData) => {
        console.log('[MangaSearch] ジャンル一覧を受信:', genreData);
        this.genres = genreData.map(item => ({
          ...item,
          active: false
        }));
      },
      error: (error) => {
        console.error('[MangaSearch] ジャンル一覧取得エラー:', error);
      }
    });
  }
  
  // ジャンル一覧の表示/非表示を切り替え
  toggleGenreList() {
    this.isGenreListVisible = !this.isGenreListVisible;
  }
  
  // ジャンルを選択
  selectGenre(genre: string) {
    console.log('[MangaSearch] ジャンル選択:', genre);
    
    // 以前選択されていたジャンルと同じ場合は選択解除
    if (this.selectedGenres.includes(genre)) {
      console.log('[MangaSearch] ジャンル選択を解除します');
      this.selectedGenres = this.selectedGenres.filter(g => g !== genre);
    } else {
      // 新しいジャンルを追加 - 複数選択をサポート
      this.selectedGenres.push(genre);
    }
    
    // アクティブ状態を更新
    this.genres = this.genres.map(g => ({
      ...g,
      active: this.selectedGenres.includes(g.genre)
    }));
    
    console.log('[MangaSearch] 選択中のジャンル:', this.selectedGenres);
  }
  
  // すべてのジャンル選択を解除
  clearAllGenres() {
    this.selectedGenres = [];
    this.genres = this.genres.map(g => ({
      ...g,
      active: false
    }));
    console.log('[MangaSearch] すべてのジャンル選択を解除しました');
  }
  
  // 検索の変更を処理
  onSearchChange(value: string) {
    console.log('[MangaSearch] 検索語を変更:', value);
    this.searchTerm = value;
    this.searchSubject.next(value);
  }
  
  // 検索ボタンクリック時の処理
  executeSearch() {
    console.log('[MangaSearch] 検索実行:', this.searchTerm, '、ジャンル:', this.selectedGenres);
    this.isLoading = true;
    
    // 検索条件に応じたAPI呼び出し
    if (this.searchTerm.trim() && this.selectedGenres.length > 0) {
      // キーワードとジャンルの複合検索
      const genresParam = this.selectedGenres.join(',');
      this.searchCombined(this.searchTerm, genresParam);
    } else if (this.selectedGenres.length > 0) {
      // ジャンルのみの検索
      this.searchBySelectedGenres();
    } else if (this.searchTerm.trim()) {
      // キーワードのみの検索
      this.performSearch(this.searchTerm);
    } else {
      // 検索条件なし - デフォルトリストを取得
      this.loadDefaultList();
    }
    
    // 注意: closeSearchは検索結果が親コンポーネントに伝わった後に
    // processSearchResultsから呼び出されるように変更するため、ここでは呼び出さない
  }
  
  // キーワード検索の実行
  private performSearch(term: string) {
    console.log('[MangaSearch] キーワード検索を実行:', term);
    
    this.mangaService.searchManga(term).subscribe({
      next: (response) => {
        console.log('[MangaSearch] 検索結果:', response);
        this.processSearchResults(response);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('[MangaSearch] 検索エラー:', error);
        this.handleError(error);
      }
    });
  }
  
  // ジャンル検索の実行
  private searchBySelectedGenres() {
    if (this.selectedGenres.length === 0) return;
    
    console.log('[MangaSearch] ジャンル検索を実行:', this.selectedGenres);
    
    // 複数ジャンルをカンマ区切りで送信
    const genresParam = this.selectedGenres.join(',');
    
    this.mangaService.searchByGenre(genresParam, null, 20).subscribe({
      next: (response) => {
        console.log('[MangaSearch] ジャンル検索結果:', response);
        // 検索結果をデバッグ出力
        if (response.data) {
          console.log('[MangaSearch] 検索結果件数:', response.data.length);
        }
        this.processSearchResults(response);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('[MangaSearch] ジャンル検索エラー:', error);
        this.handleError(error);
      }
    });
  }
  
  // キーワードとジャンルを組み合わせた検索
  private searchCombined(term: string, genres: string) {
    console.log('[MangaSearch] 複合検索を実行');
    
    this.mangaService.searchCombined(term, genres, null).subscribe({
      next: (response) => {
        console.log('[MangaSearch] 複合検索結果:', response);
        this.processSearchResults(response);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('[MangaSearch] 複合検索エラー:', error);
        this.handleError(error);
      }
    });
  }
  
  // デフォルトの漫画リストを取得
  public loadDefaultList() {
    console.log('[MangaSearch] デフォルトリストを取得');
    
    this.mangaService.searchManga('').subscribe({
      next: (response) => {
        console.log('[MangaSearch] デフォルトリスト取得結果:', response);
        this.processSearchResults(response);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('[MangaSearch] デフォルトリスト取得エラー:', error);
        this.handleError(error);
      }
    });
  }
  
  // 検索結果を処理する
  private processSearchResults(response: PaginatedResponse<Manga>) {
    console.log('[MangaSearch] 検索結果を処理:', response);
    const mangaArray = response.data || [];
    // 検索結果・検索語・ジャンルをまとめてemit
    this.searchResults.emit({
      results: mangaArray,
      searchTerm: this.searchTerm,
      selectedGenres: [...this.selectedGenres],
      nextCursor: response.nextCursor,
      hasMore: response.hasMore
    });
    setTimeout(() => {
      this.closeSearch.emit();
    }, 300);
  }
  
  // エラー処理
  private handleError(error: any) {
    console.error('[MangaSearch] エラー:', error);
    this.isLoading = false;
    
    // エラー時は空の結果を返す
    this.searchResults.emit({
      results: [],
      searchTerm: '',
      selectedGenres: [],
      nextCursor: undefined,
      hasMore: false
    });
  }
  
  // 検索を閉じる
  hideSearch() {
    console.log('[MangaSearch] 検索画面を閉じます');
    this.closeSearch.emit();
  }
}
