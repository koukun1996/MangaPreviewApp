import { Component, OnInit, HostListener, PLATFORM_ID, Inject, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from "@angular/core";
import { CommonModule, isPlatformBrowser, isPlatformServer } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MangaService, PagingCursor, PaginatedResponse } from "../../services/manga.service";
import { Manga } from "../../models/manga.interface";
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from "rxjs";
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AdultConfirmationDialogComponent } from "../AdultConfirmationDialogComponent/adult-confirmation-dialog.component";
import { ActivatedRoute, Router } from '@angular/router';
import { SeoService } from '../../services/seo.service';
import { MangaSearchComponent, MangaSearchResultEvent } from '../manga-search/manga-search.component';

interface GenreItem {
  genre: string;
  count: number;
  active?: boolean;
}

@Component({
  selector: "app-manga-viewer",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, AdultConfirmationDialogComponent, MangaSearchComponent],
  templateUrl: "./manga-viewer.component.html",
  styleUrls: ["./manga-viewer.component.scss", "../../../../src/custom-theme.scss"],
  styles: [`
    .custom-dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
    
    .custom-dialog {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      width: 300px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    .custom-dialog-title {
      font-size: 20px;
      margin-bottom: 16px;
      color: #333;
    }
    
    .custom-dialog-content {
      margin-bottom: 20px;
    }
    
    .custom-dialog-actions {
      display: flex;
      justify-content: space-between;
    }
    
    .btn-primary {
      background-color: #007bff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .btn-secondary {
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
  `]
})
export class MangaViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  currentManga: Manga | null = null;
  mangaList: Manga[] = [];
  currentIndex = 0;
  // 現在のページで使用するカーソル情報
  currentCursor: PagingCursor | null = null;
  // 次のページをロードするためのカーソル情報
  nextCursor: PagingCursor | null = null;
  // 前のページのカーソル履歴（戻る操作用）
  cursorHistory: PagingCursor[] = [];
  // ページングに関する情報
  hasMorePages = true;
  
  searchTerm = "";
  searchQuery = ""; // 検索クエリ用プロパティを追加
  isLoading = true;
  isSearchVisible = false;
  currentImageIndex = 0;
  isAdult = true; // デフォルトで成人と想定
  isSidebarVisible = false; // サイドバー表示状態の管理

  // カスタムダイアログ用の状態
  showCustomDialog = false;

  // タッチイベント用の変数
  private _swipeStart: Touch | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private readonly SWIPE_THRESHOLD = 50;
  private readonly TAP_THRESHOLD = 10;
  private readonly TAP_DURATION = 300; // ミリ秒
  private touchStartTime = 0;

  isImageLoading = false;

  private lastScrollTop = 0;
  private headerTimeout: any;
  isHeaderVisible = true;

  // デバイスタイプの検出用
  isMobileDevice = false;
  isPermanentHeaderVisible = false; // PC用の常時表示ヘッダー制御用

  // 新しいプロパティを追加
  isHelpModalVisible = false; // ヘルプモーダルの表示状態

  // ジャンル関連の状態
  genres: GenreItem[] = [];
  selectedGenres: string[] = []; // 複数ジャンル選択をサポート
  isGenreListVisible = false;

  mangaId: string | null = null;
  displayManga: Manga | null = null;
  error: string | null = null;

  selectedManga: Manga | null = null;
  isLoadingMore = false;

  // 検索結果モードを追加
  isSearchResultMode = false;

  // ページネーション情報
  pagination = {
    hasNextPage: false,
    hasPreviousPage: false
  };

  private destroy$ = new Subject<void>();

  @ViewChild('scrollObserver') scrollObserver: ElementRef | undefined;
  private intersectionObserver: IntersectionObserver | undefined;

  // 全体のリスト
  allMangaList: Manga[] = [];
  // 表示用リスト
  displayMangaList: Manga[] = [];
  // 現在のオフセット
  currentOffset = 0;
  // 1ページあたりの件数
  readonly PAGE_SIZE = 20;

  // クラスのプロパティに追加
  displayGenre: string = ''; // 表示用のジャンル名

  // ジャンル検索モードフラグを追加
  isGenreSearchMode = false;

  constructor(
    private mangaService: MangaService,
    public dialog: MatDialog,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private seoService: SeoService
  ) {
    console.log('[DEBUG] MangaViewerComponent constructor called');
    this.isMobileDevice = this.checkIfMobile();
  }

  ngOnInit(): void {
    console.log('[DEBUG] MangaViewerComponent ngOnInit called');
    
    // 初期状態ではローディング中とする
    this.isLoading = true;
    
    // スマホ・タブレットの判定
    this.checkDeviceType();

    // URLパラメータからIDを取得
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.mangaId = params['id'];
        console.log('[DEBUG] Manga ID from route:', this.mangaId);
        if (this.mangaId) {
          this.loadMangaData(this.mangaId);
        }
      } else {
        console.log('[DEBUG] No manga ID in route, loading latest manga');
        this.loadLatestManga();
      }
    });

    // ページネーションの初期化
    this.initPagination();
    
    // 成人確認の状態を確認
    this.checkAdultConfirmation();
    
    // ジャンル一覧を取得
    this.fetchGenres();
    
    // タッチイベントの初期化
    this.initTouchEvents();
  }

  ngAfterViewInit(): void {
    console.log('[DEBUG] ngAfterViewInit called, platformId:', this.platformId);
    console.log('[DEBUG] isPlatformBrowser result:', isPlatformBrowser(this.platformId));
    
    // ブラウザ環境でのみ実行する処理
    if (isPlatformBrowser(this.platformId)) {
      console.log('[DEBUG] Browser environment detected');
      
      // 以前に年齢確認がされているか確認
      const hasConfirmedAge = localStorage.getItem('age_confirmed');
      
      if (!hasConfirmedAge) {
        // DOM更新サイクル後にダイアログを表示
        setTimeout(() => {
          // カスタムダイアログを表示
          this.showCustomAdultConfirmation();
        }, 500);
      }
      
      // 無限スクロール用のインターセクションオブザーバーを設定
      this.setupIntersectionObserver();
    }
  }

  ngOnDestroy() {
    if (this.headerTimeout) {
      clearTimeout(this.headerTimeout);
    }
    
    // タッチイベントリスナーを削除
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('touchstart', this.onTouchStart.bind(this));
      document.removeEventListener('touchend', this.onTouchEnd.bind(this));
    }
    
    // インターセクションオブザーバーを解除
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.isMobileDevice = this.checkIfMobile();
  }

  private checkIfMobile(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return window.innerWidth <= 768;
    }
    // SSRの場合はデフォルトでfalseを返す
    return false;
  }

  // カスタムダイアログを表示
  showCustomAdultConfirmation(): void {
    console.log('[DEBUG] Showing custom adult confirmation dialog');
    this.showCustomDialog = true;
  }

  // 検索の表示/非表示を切り替え
  toggleSearch() {
    console.log('[DEBUG] Toggle search');
    this.isSearchVisible = !this.isSearchVisible;
    
    if (this.isSearchVisible && isPlatformBrowser(this.platformId)) {
      // 少し遅延させてから検索入力欄にフォーカスする
      setTimeout(() => {
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    }
  }
  
  // 検索を非表示にする
  hideSearch() {
    console.log('[DEBUG] Hide search');
    this.isSearchVisible = false;
  }

  // 検索ボタンクリック時の処理
  executeSearch() {
    console.log('[DEBUG] Executing search with term:', this.searchTerm, 'and genres:', this.selectedGenres);
    this.isLoading = true;
    this.isLoadingMore = false;
    this.hideSearch();
    
    // 検索結果モードに切り替える
    this.isSearchResultMode = true;
    
    // 検索クエリを保存
    this.searchQuery = this.searchTerm.trim();
    
    // Reset pagination
    this.currentCursor = null;
    this.nextCursor = null;
    this.cursorHistory = [];
    
    // Clear existing manga list
    this.mangaList = [];
    
    // If search term is provided, perform search
    if (this.searchTerm.trim() && this.selectedGenres.length > 0) {
      // 複合検索
      const genresParam = this.selectedGenres.join(',');
      this.mangaService.searchCombined(this.searchTerm, genresParam, null).subscribe({
        next: (response) => this.handlePaginatedResponse(response),
        error: (error) => this.handleError(error, '検索中')
      });
    } else if (this.selectedGenres.length > 0) {
      // ジャンルのみの検索
      this.searchBySelectedGenres();
    } else if (this.searchTerm.trim()) {
      // キーワードのみの検索
      this.mangaService.searchManga(this.searchTerm, null).subscribe({
        next: (response) => this.handlePaginatedResponse(response),
        error: (error) => this.handleError(error, '検索中')
      });
    } else {
      // No criteria provided - load default list
      this.loadManga();
    }
  }

  // 検索結果モードを終了
  exitSearchResultMode() {
    console.log('[DEBUG] Exit search result mode');
    this.isSearchResultMode = false;
    
    // 最初の漫画を表示
    if (this.mangaList.length > 0) {
      this.currentIndex = 0;
      this.updateCurrentManga(this.mangaList[0]);
    }
  }
  
  // 検索結果から漫画を選択して通常モードに戻る
  selectMangaAndExit(manga: Manga, index: number): void {
    console.log('[DEBUG] Selecting manga and exiting search mode:', manga.title);
    // 現在のマンガをセット
    this.currentManga = manga;
    this.currentIndex = index;
    this.mangaList = [...this.allMangaList]; // 選択時に全体リストをmangaListにコピー
    
    // 検索結果モードを終了
    this.isSearchResultMode = false;
    
    // UIの更新を強制
    this.cdr.detectChanges();
    
    // 画像インデックスをリセット
    this.currentImageIndex = 0;
    
    console.log('[DEBUG] Selected manga:', this.currentManga);
  }
  
  // 通常ロードとジャンル検索用の共通メソッド
  loadManga(keyword: string = "") {
    this.isLoading = true;
    this.isImageLoading = true;
    console.log('[Client] 漫画読み込み開始:', keyword);
    
    // 検索モードをリセット（通常表示モードに）
    this.isSearchResultMode = false;
    
    // 検索語と選択ジャンルをリセット（明示的なリセット操作以外ではリセットしない）
    if (keyword === "" && arguments.length > 0) {
      this.searchTerm = "";
      this.selectedGenres = [];
      
      // ジャンルの選択状態もリセット
      if (this.genres.length > 0) {
        this.genres = this.genres.map(g => ({
          ...g,
          active: false
        }));
      }
    }
    
    // カーソル情報をリセット
    this.currentCursor = null;
    this.nextCursor = null;
    this.cursorHistory = [];
    
    this.mangaService.searchManga(keyword, null).subscribe({
      next: (response: PaginatedResponse<Manga>) => {
        console.log('[Client] 漫画データ受信:', response);
        this.mangaList = response.data || [];
        this.hasMorePages = response.hasMore;
        this.nextCursor = response.nextCursor;
        
        this.logCurrentStateDebug('[データロード結果受信後]');
        
        this.currentIndex = 0;
        
        if (this.mangaList.length > 0) {
          // 一度nullにして確実に更新を発生させる
          this.currentManga = null;
          this.cdr.detectChanges(); // 変更を即時反映
          
          setTimeout(() => {
            this.currentManga = {...this.mangaList[0]};  // オブジェクトを複製して新しい参照を作成
            console.log('[Client] 作品を表示:', this.currentManga?.title);
            this.currentImageIndex = 0;
            this.preloadImages();
            this.isLoading = false;
            this.isImageLoading = false;
            this.cdr.detectChanges(); // 変更を即時反映
            this.logCurrentStateDebug('[データロード結果表示完了]');
          }, 50);
        } else {
          console.log('[Client] 漫画データがありません');
          this.currentManga = null;
          this.isLoading = false;
          this.isImageLoading = false;
          this.cdr.detectChanges(); // 変更を即時反映
          this.logCurrentStateDebug('[データロード結果なし]');
        }
      },
      error: (error: any) => {
        console.error("[Client] 読み込みエラー:", error);
        this.mangaList = [];
        this.currentManga = null;
        this.isLoading = false;
        this.isImageLoading = false;
        this.handleError(error, '漫画データの読み込み');
        this.cdr.detectChanges(); // 変更を即時反映
        this.logCurrentStateDebug('[データロードエラー]');
      },
    });
  }

  // ページ内の漫画を順次表示。末尾の場合は次ページを取得
  nextManga() {
    console.log('[DEBUG] nextManga called, currentIndex=', this.currentIndex, 'mangaList.length=', this.mangaList.length);
    
    // データをロード中の場合は処理しない
    if (this.isLoading || this.isLoadingMore) {
      console.log('[DEBUG] Loading in progress, skipping nextManga call');
      return;
    }
    
    if (this.currentIndex < this.mangaList.length - 1) {
      // まだリスト内に次の漫画がある場合
      this.currentIndex++;
      this.updateCurrentManga(this.mangaList[this.currentIndex]);
    } else if (this.hasMorePages && this.nextCursor) {
      // 次のページがあればロード
      console.log('[DEBUG] Reached end of current manga list, fetching next page with cursor:', 
        this.nextCursor ? JSON.stringify(this.nextCursor) : 'null');
      
      // フラグを設定してフェッチ中を示す
      this.isLoading = true;
      
      // カーソル情報の整合性チェック
      if (this.nextCursor && (!this.nextCursor.lastId || !this.nextCursor.lastUpdatedAt)) {
        console.warn('[DEBUG] Next cursor has missing properties:', this.nextCursor);
        // 最低限の情報を設定
        if (!this.nextCursor.lastId) this.nextCursor.lastId = '';
        if (!this.nextCursor.lastUpdatedAt) this.nextCursor.lastUpdatedAt = '';
      }
      
      this.fetchNextPage();
    } else {
      console.log('[Client] これ以上の漫画はありません');
    }
  }

  // ページ内の漫画を逆順で表示。先頭の場合は前ページを取得
  previousManga() {
    console.log('[DEBUG] previousManga called, currentIndex=', this.currentIndex, 'cursorHistory.length=', this.cursorHistory.length);
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateCurrentManga(this.mangaList[this.currentIndex]);
    } else if (this.cursorHistory.length > 0) {
      this.previousPage();
    } else {
      console.log('[Client] 最初の漫画です');
    }
  }

  /**
   * 次のページのデータを取得
   */
  private fetchNextPage(): void {
    console.log('[MangaViewer] fetchNextPage called');
    
    // データ読み込み中の場合は処理しない
    if (this.isLoadingMore) {
      console.log('[MangaViewer] Already loading more data, skipping fetch');
      return;
    }
    
    // 読み込み中フラグを設定
    this.isLoadingMore = true;
    
    // カーソル情報のディープコピーを作成（必ず新しいオブジェクトを作成）
    const cursorToSend = this.nextCursor ? JSON.parse(JSON.stringify(this.nextCursor)) : null;
    console.log('[MangaViewer] Fetching next page with cursor:', cursorToSend ? JSON.stringify(cursorToSend) : 'null');
    
    // カーソル情報が不完全な場合は空のカーソルを使用する
    if (cursorToSend && (!cursorToSend.lastId || !cursorToSend.lastUpdatedAt)) {
      console.warn('[MangaViewer] Cursor information is incomplete. Creating empty cursor.');
      // 空文字列でもカーソル情報を作成しておく
      cursorToSend.lastId = cursorToSend.lastId || '';
      cursorToSend.lastUpdatedAt = cursorToSend.lastUpdatedAt || '';
    }
    
    // ジャンル検索モードの場合
    if (this.isGenreSearchMode) {
      console.log('[MangaViewer] Fetching next page in genre search mode');
      console.log('[MangaViewer] Selected genres:', this.selectedGenres);
      
      // 選択されたジャンルがない場合は全ジャンル
      if (!this.selectedGenres || this.selectedGenres.length === 0) {
        console.log('[MangaViewer] No genres selected, using "全ジャンル"');
        this.mangaService.searchByGenre('全ジャンル', cursorToSend, 20)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              console.log('[MangaViewer] Got response for all genres search - data count:', response.data?.length || 0);
              this.handlePaginatedResponse(response);
            },
            error: (error) => {
              console.error('[MangaViewer] Error fetching next page for all genres:', error);
              this.isLoadingMore = false;
              this.cdr.detectChanges();
            }
          });
      } else {
        // 複数ジャンル選択サポート（最初のジャンルのみ使用）
        const primaryGenre = this.selectedGenres[0];
        console.log('[MangaViewer] Using primary genre for search:', primaryGenre);
        
        this.mangaService.searchByGenre(primaryGenre, cursorToSend, 20)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              console.log('[MangaViewer] Got response for genre search - data count:', response.data?.length || 0);
              this.handlePaginatedResponse(response);
            },
            error: (error) => {
              console.error('[MangaViewer] Error fetching next page for genre:', error);
              this.isLoadingMore = false;
              this.cdr.detectChanges();
            }
          });
      }
    } else if (this.isSearchResultMode) {
      // 検索結果モードの場合
      console.log('[MangaViewer] Fetching next page in search result mode');
      console.log('[MangaViewer] Current search query:', this.searchQuery);
      
      // 検索モードでジャンルも選択されている場合は複合検索を実行
      if (this.selectedGenres && this.selectedGenres.length > 0) {
        console.log('[MangaViewer] Combined search with genres and query');
        const genresParam = this.selectedGenres.join(',');
        
        this.mangaService.searchCombined(this.searchQuery, genresParam, cursorToSend, 20)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              console.log('[MangaViewer] Got response for combined search - data count:', response.data?.length || 0);
              this.handlePaginatedResponse(response);
              this.logResponseData(response);
            },
            error: (error) => {
              console.error('[MangaViewer] Error fetching next page for combined search:', error);
              this.isLoadingMore = false;
              this.cdr.detectChanges();
            }
          });
      } else {
        // キーワード検索のみの場合
        this.mangaService.searchManga(this.searchQuery, cursorToSend, 20)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              console.log('[MangaViewer] Got response for keyword search - data count:', response.data?.length || 0);
              this.handlePaginatedResponse(response);
              this.logResponseData(response);
            },
            error: (error) => {
              console.error('[MangaViewer] Error fetching next page for search:', error);
              this.isLoadingMore = false;
              this.cdr.detectChanges();
            }
          });
      }
    } else {
      // 通常モード（おすすめ）の場合
      console.log('[MangaViewer] Fetching next page in recommendation mode');
      
      // レコメンデーションAPIにはカーソル情報以外のパラメータも必要
      const emptyArrays: string[] = [];
      
      this.mangaService.getRecommendations(
        emptyArrays, // genres
        emptyArrays, // tags
        emptyArrays, // authors
        emptyArrays, // excludeIds
        cursorToSend, // cursor
        20 // limit
      )
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            console.log('[MangaViewer] Got response for recommendations - data count:', response.data?.length || 0);
            this.handlePaginatedResponse(response);
            this.logResponseData(response);
          },
          error: (error) => {
            console.error('[MangaViewer] Error fetching next page for recommendations:', error);
            this.isLoadingMore = false;
            this.cdr.detectChanges();
          }
        });
    }
  }

  goToProduct() {
    if (!isPlatformBrowser(this.platformId)) {
      console.log('[DEBUG] Not in browser environment');
      return;
    }
    
    console.log('[DEBUG] Current Manga:', JSON.stringify(this.currentManga, null, 2));
    console.log('[DEBUG] Product URL:', this.currentManga?.affiliateUrl);
    if (this.currentManga?.affiliateUrl) {
      window.open(this.currentManga.affiliateUrl, "_blank");
    } else {
      console.log('[DEBUG] affiliateUrl is not set');
    }
  }

  goToTachiyomi() {
    console.log('[DEBUG] goToTachiyomi called');
    if (!isPlatformBrowser(this.platformId)) {
      console.log('[DEBUG] Not in browser environment');
      return;
    }
    
    if (!this.currentManga) {
      console.error('[ERROR] Cannot navigate to tachiyomi page: currentManga is null');
      return;
    }
    
    console.log('[DEBUG] Current Manga title:', this.currentManga.title);
    console.log('[DEBUG] Tachiyomi URL:', this.currentManga.tachiyomiUrl);
    
    if (this.currentManga.tachiyomiUrl) {
      // IEやEdgeなどの一部のブラウザ対策でtryブロックで囲む
      try {
        window.open(this.currentManga.tachiyomiUrl, "_blank", "noopener,noreferrer");
        console.log('[DEBUG] Successfully opened tachiyomi URL in a new tab');
      } catch (error) {
        console.error('[ERROR] Failed to open tachiyomi URL:', error);
        // フォールバック
        window.location.href = this.currentManga.tachiyomiUrl;
      }
    } else {
      console.error('[ERROR] tachiyomiUrl is not set for the current manga');
      alert('この漫画の立ち読みページはありません。');
    }
  }

  nextImage() {
    const totalImages = (this.currentManga?.sampleImageUrls?.length || 0) + 1;
    this.currentImageIndex = (this.currentImageIndex + 1) % totalImages;
  }

  previousImage() {
    const totalImages = (this.currentManga?.sampleImageUrls?.length || 0) + 1;
    this.currentImageIndex = this.currentImageIndex === 0 ? totalImages - 1 : this.currentImageIndex - 1;
  }

  getCurrentImage(): string {
    if (!this.currentManga) {
      console.error('[ERROR] getCurrentImage: currentManga is null or undefined');
      return "";
    }
    
    let imageUrl = "";
    
    if (this.currentImageIndex === 0) {
      imageUrl = this.currentManga.thumbnailUrl || "";
    } else {
      const sampleImages = this.currentManga.sampleImageUrls || [];
      if (this.currentImageIndex - 1 < sampleImages.length) {
        imageUrl = sampleImages[this.currentImageIndex - 1];
      } else {
        imageUrl = this.currentManga.thumbnailUrl || "";
      }
    }
    
    console.log('[DEBUG] getCurrentImage returning URL:', imageUrl);
    return imageUrl;
  }

  // タッチイベントリスナーを初期化
  private initTouchEvents(): void {
    if (isPlatformBrowser(this.platformId)) {
      console.log('[DEBUG] Initializing touch events');
      // タッチイベントリスナーはブラウザ環境でのみ追加
      document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
      document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    }
  }

  // タッチ開始イベントハンドラー
  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.touchStartTime = Date.now();
    console.log('[DEBUG] Touch start at X:', this.touchStartX, 'Y:', this.touchStartY);
  }

  // タッチ終了イベントハンドラー
  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].clientX;
    this.touchEndY = event.changedTouches[0].clientY;
    const touchDuration = Date.now() - this.touchStartTime;
    
    console.log('[DEBUG] Touch end at X:', this.touchEndX, 'Y:', this.touchEndY);
    console.log('[DEBUG] Touch duration:', touchDuration, 'ms');

    // タップ判定
    const deltaX = Math.abs(this.touchEndX - this.touchStartX);
    const deltaY = Math.abs(this.touchEndY - this.touchStartY);

    // 検索やサイドバーが表示されている場合はスワイプを無効化
    if (this.isSearchVisible || this.isSidebarVisible) {
      console.log('[DEBUG] Swipe disabled due to open overlay');
      return;
    }

    if (deltaX < this.TAP_THRESHOLD && deltaY < this.TAP_THRESHOLD && touchDuration < this.TAP_DURATION) {
      // タップの場合は立ち読みページへ遷移
      // モバイルデバイスの場合のみイベント伝播を制御
      if (this.isMobileDevice) {
        console.log('[DEBUG] Tap detected, navigating to tachiyomi');
        if (event.target instanceof HTMLElement && event.target.closest('.manga-image-container')) {
          event.preventDefault();
          event.stopPropagation();
          this.goToTachiyomi();
        }
      }
      return;
    }

    // スワイプ判定
    const swipeDistance = this.touchEndX - this.touchStartX;
    const verticalDistance = Math.abs(this.touchEndY - this.touchStartY);
    
    // 水平方向のスワイプが垂直方向より大きい場合のみ処理
    if (Math.abs(swipeDistance) > this.SWIPE_THRESHOLD && Math.abs(swipeDistance) > verticalDistance) {
      console.log('[DEBUG] Swipe detected, distance:', swipeDistance);
      if (swipeDistance > 0) {
        // 右スワイプで前のページへ
        console.log('[DEBUG] Right swipe, navigating to previous manga');
        this.previousManga();
      } else {
        // 左スワイプで次のページへ
        console.log('[DEBUG] Left swipe, navigating to next manga');
        this.nextManga();
      }
    }
  }

  // カスタムダイアログのyes/noボタンのハンドラ
  onCustomConfirm(): void {
    console.log('[DEBUG] User confirmed they are adult');
    this.showCustomDialog = false;
    this.isAdult = true;
    
    if (isPlatformBrowser(this.platformId)) {
      // 確認を保存
      localStorage.setItem('age_confirmed', 'true');
    }
    
    // データを再度読み込む
    this.loadManga(this.searchTerm);
  }

  onCustomCancel(): void {
    console.log('[DEBUG] User canceled adult confirmation');
    this.showCustomDialog = false;
    this.isAdult = false;
    // 年齢確認がキャンセルされた場合は何も表示しない
  }

  preloadImages() {
    if (isPlatformServer(this.platformId)) {
      console.log('[MangaViewerComponent] サーバーサイドでは画像のプリロードをスキップします');
      return; // サーバーサイドでは何もしない
    }

    // ブラウザ環境での画像プリロード処理
    this.mangaList.forEach(manga => {
      const img = new Image();
      img.src = manga.thumbnailUrl; // ここで画像をプリロード
    });
  }

  // 漫画が変更されたときにプリロードを実行
  private updateCurrentManga(manga: Manga) {
    if (!manga) return;
    this.currentManga = null;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.currentManga = { ...manga };
      this.cdr.detectChanges();
      console.log('[MangaViewer] updateCurrentMangaでセット:', this.currentManga);
    }, 50);
  }

  // 画像読み込み完了時の処理
  onImageLoad() {
    console.log('[Client] 画像の読み込みが完了しました', this.currentManga?.title);
    this.isImageLoading = false;
  }

  onImageError() {
    console.log('[DEBUG] Image loading error');
    // 画像読み込みエラー時もローディング状態を解除
    this.isImageLoading = false;
    this.cdr.detectChanges();
  }

  private handleError(error: any, operation: string) {
    console.error(`[DEBUG] ${operation}でエラーが発生しました:`, error);
    this.isLoading = false;
    this.isImageLoading = false;
    
    // operation が漫画データの読み込みの場合は、自動的に再読み込みを試行
    if (operation === '漫画データの読み込み' && this.mangaList.length === 0) {
      console.log('[Client] 初期データのロードに失敗したため再試行します');
      
      // 少し待ってから再試行
      setTimeout(() => {
        this.loadManga();
      }, 2000);
    } else {
      // エラーメッセージを表示
      if (isPlatformBrowser(this.platformId)) {
        alert(`${operation}中にエラーが発生しました。もう一度お試しください。`);
      }
    }
  }

  // デバイスタイプを検出する関数
  checkDeviceType(): void {
    if (isPlatformBrowser(this.platformId)) {
      // ブラウザ環境でのみwindowオブジェクトを使用
      this.isMobileDevice = window.innerWidth < 768;
    } else {
      // サーバー環境ではデフォルト値を設定
      this.isMobileDevice = false;
    }
  }

  // ヘッダー制御の設定
  private setupHeaderControl(): void {
    // モバイルの場合のみスクロールベースのヘッダー制御を適用
    if (this.isMobileDevice) {
      this.setupHeaderAutoHide();
    } else {
      // PC/タブレットの場合は常に表示
      this.isHeaderVisible = true;
    }
  }

  private setupHeaderAutoHide(): void {
    // モバイルデバイスの場合のみ適用
    if (!this.isMobileDevice) return;
    
    let lastScrollY = window.scrollY;
    let ticking = false;

    window.addEventListener('scroll', () => {
      lastScrollY = window.scrollY;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          this.handleScroll(lastScrollY);
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  private handleScroll(scrollY: number) {
    // スクロール方向を判定
    const scrollingDown = scrollY > this.lastScrollTop;
    this.lastScrollTop = scrollY;

    // スクロール量が非常に小さい場合は無視（タップした時のわずかなスクロールを防ぐ）
    if (Math.abs(scrollY - this.lastScrollTop) < 5) {
      return;
    }

    // ヘッダーの表示/非表示を制御
    if (scrollingDown && scrollY > 50 && this.isHeaderVisible) {
      this.isHeaderVisible = false;
    } else if (!scrollingDown && !this.isHeaderVisible) {
      this.isHeaderVisible = true;
    }

    // スクロール停止時にヘッダーを表示
    if (this.headerTimeout) {
      clearTimeout(this.headerTimeout);
    }

    this.headerTimeout = setTimeout(() => {
      this.isHeaderVisible = true;
    }, 2000); // 2秒後にヘッダーを表示（より素早くする）
  }

  // サイドバーの表示/非表示を切り替える
  toggleSidebar(): void {
    this.isSidebarVisible = !this.isSidebarVisible;
  }

  // サイドバーを閉じる
  closeSidebar(): void {
    this.isSidebarVisible = false;
  }

  // ヘルプモーダルを表示する
  showHelpModal(): void {
    this.isHelpModalVisible = true;
  }
  
  // ヘルプモーダルを閉じる
  closeHelpModal(): void {
    this.isHelpModalVisible = false;
  }

  // レコメンデーション漫画を取得
  getRecommendations() {
    console.log('[DEBUG] getRecommendations called, currentManga=', this.currentManga?.title);
    this.isLoading = true;
    this.isImageLoading = true;
    console.log('[Client] レコメンデーション取得開始');

    // 現在の漫画からタグとジャンル、作者を抽出
    const tags = this.currentManga?.tags || [];
    const authors = this.currentManga?.author ? [this.currentManga.author] : [];
    
    // すでに表示した漫画を除外
    const excludeIds = this.currentManga ? [this.currentManga.fanzaId] : [];
    
    // カーソル情報をリセット
    this.currentCursor = null;
    this.nextCursor = null;
    this.cursorHistory = [];
    
    // キーワード検索を代わりに使用
    this.mangaService.searchManga('', null, 10).subscribe({
      next: (response: PaginatedResponse<Manga>) => {
        console.log('[Client] レコメンデーション代替で受信した結果:', response);
        this.mangaList = response.data || [];
        this.hasMorePages = response.hasMore;
        this.nextCursor = response.nextCursor;

        this.currentIndex = 0;
        this.currentManga = null; // 一度nullにして確実に更新を発生させる
        this.cdr.detectChanges(); // 変更を即時反映

        setTimeout(() => {
          if (this.mangaList.length > 0) {
            this.currentManga = {...this.mangaList[0]};  // オブジェクトを複製して新しい参照を作成
            console.log('[Client] おすすめ漫画を表示:', this.currentManga?.title);
          } else {
            this.currentManga = null;
            console.log('[Client] おすすめ漫画が見つかりませんでした');
          }
          this.currentImageIndex = 0;
          this.preloadImages();
          this.isLoading = false;
          this.isImageLoading = false;
          this.cdr.detectChanges(); // 変更を即時反映
          this.logCurrentStateDebug('[レコメンデーション表示完了]');
        }, 50);
      },
      error: (error: any) => {
        console.error("[Client] レコメンデーションエラー:", error);
        this.mangaList = [];
        this.currentManga = null;
        this.isLoading = false;
        this.isImageLoading = false;
        this.cdr.detectChanges(); // 変更を即時反映
        this.logCurrentStateDebug('[レコメンデーションエラー]');
      },
    });
  }

  // ジャンル一覧を読み込む
  fetchGenres() {
    console.log('[Client] ジャンル一覧を取得中...');
    this.mangaService.getGenreCounts().subscribe({
      next: (genreData) => {
        console.log('[Client] ジャンル一覧を受信:', genreData);
        this.genres = genreData.map(item => ({
          ...item,
          active: false
        }));
      },
      error: (error) => {
        console.error('[Client] ジャンル一覧取得エラー:', error);
      }
    });
  }
  
  // ジャンル一覧の表示/非表示を切り替え
  toggleGenreList() {
    this.isGenreListVisible = !this.isGenreListVisible;
  }
  
  // ジャンルを選択して検索を実行
  selectGenre(genre: string) {
    console.log('[Client] ジャンル選択:', genre);
    
    // 以前選択されていたジャンルと同じ場合は選択解除
    if (this.selectedGenres.includes(genre)) {
      console.log('[Client] ジャンル選択を解除します');
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
    
    console.log('[Client] 選択中のジャンル:', this.selectedGenres);
  }

  // デバッグ用に現在の状態をログ出力
  private logCurrentStateDebug(prefix: string) {
    console.log(`${prefix} 状態:`, {
      currentManga: this.currentManga ? {
        title: this.currentManga.title,
        id: this.currentManga.fanzaId,
        imageUrl: this.currentManga.thumbnailUrl
      } : null,
      mangaListCount: this.mangaList.length,
      isLoading: this.isLoading,
      isImageLoading: this.isImageLoading,
      searchTerm: this.searchTerm,
      selectedGenres: this.selectedGenres
    });
  }

  // ジャンルを選択して検索を実行
  private searchBySelectedGenres() {
    if (this.selectedGenres.length === 0) return;

    this.isLoading = true;
    this.isImageLoading = true;
    
    // 検索結果モードに切り替える
    this.isSearchResultMode = true;
    
    // カーソル情報をリセット
    this.currentCursor = null;
    this.nextCursor = null;
    this.cursorHistory = [];
    
    // リストもリセット
    this.allMangaList = [];
    this.mangaList = [];
    this.displayMangaList = [];

    // 複数ジャンルをカンマ区切りで送信
    const genresParam = this.selectedGenres.join(','); // 複数ジャンルをカンマ区切りに
    console.log('[Client] ジャンル検索を実行:', genresParam);
    
    // limitを20に統一
    this.mangaService.searchByGenre(genresParam, null, 20).subscribe({
      next: (response: PaginatedResponse<Manga>) => {
        console.log('[Client] ジャンル検索結果:', response);
        console.log('[DEBUG] ジャンル検索で取得したデータ数:', response.data?.length || 0);
        
        // データIDをログ出力して確認
        if (response.data && response.data.length > 0) {
          console.log('[DEBUG] 取得データの最初のID:', response.data[0].fanzaId);
          console.log('[DEBUG] 取得データの最後のID:', response.data[response.data.length - 1].fanzaId);
        }
        
        // 次ページカーソル情報をログ出力
        if (response.nextCursor) {
          console.log('[DEBUG] 次ページカーソル情報:', JSON.stringify(response.nextCursor));
        }
        
        // 検索結果を処理
        this.handlePaginatedResponse(response);
        
        // 検索結果モードを設定（handlePaginatedResponseでは設定されない場合の対策）
        setTimeout(() => {
          if (this.mangaList.length > 0) {
            this.isSearchResultMode = true;
            this.cdr.detectChanges();
          }
        }, 100);
      },
      error: (error) => {
        console.error('[Client] ジャンル検索エラー:', error);
        this.handleError(error, 'ジャンル検索中');
        this.isLoading = false;
        this.isImageLoading = false;
        this.currentManga = null;
        this.cdr.detectChanges(); // 変更を即時反映
      }
    });
  }

  // すべてのジャンル選択を解除
  clearAllGenres() {
    this.selectedGenres = [];
    this.genres = this.genres.map(g => ({
      ...g,
      active: false
    }));
    console.log('[Client] すべてのジャンル選択を解除しました');
  }

  // 漫画データを読み込む
  loadMangaData(id: string): void {
    console.log('[DEBUG] loadMangaData called with id:', id);
    this.isLoading = true;
    
    this.mangaService.getMangaById(id).subscribe({
      next: (data: Manga) => {
        console.log('[DEBUG] Manga data loaded:', data);
        this.displayManga = data;
        this.isLoading = false;
        
        // SEO最適化：メタタグと構造化データを設定
        this.seoService.setMangaDetailMeta(data);
        
        // 現在のタグを選択状態にする
        if (data.tags && this.genres.length > 0) {
          this.updateGenreSelection(data.tags);
        }
        
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[ERROR] Failed to load manga data:', err);
        this.isLoading = false;
        this.error = '漫画データの読み込みに失敗しました。';
      }
    });
  }

  // 漫画データを読み込む
  loadLatestManga() {
    console.log('[Client] 最新の漫画データを取得');
    this.loadManga();
  }

  // ジャンルを選択して検索を実行
  private updateGenreSelection(tags: string[]) {
    console.log('[Client] タグを選択状態にする:', tags);
    this.selectedGenres = tags;
    this.genres = this.genres.map(g => ({
      ...g,
      active: this.selectedGenres.includes(g.genre)
    }));
    console.log('[Client] 選択中のジャンル:', this.selectedGenres);
  }

  initPagination(): void {
    console.log('[DEBUG] Initializing pagination');
    this.pagination = {
      hasNextPage: false,
      hasPreviousPage: false
    };
    this.currentCursor = null;
    this.nextCursor = null;
    this.cursorHistory = [];
  }

  checkAdultConfirmation(): void {
    const hasConfirmedAge = localStorage.getItem('age_confirmed');
    if (!hasConfirmedAge) {
      this.showCustomAdultConfirmation();
    }
  }

  showMangaDetails(manga: Manga): void {
    this.selectedManga = manga;
    console.log('[DEBUG] Selected manga:', manga.title);
  }

  closeSelectedManga(): void {
    this.selectedManga = null;
  }

  searchByTag(tag: string): void {
    console.log('[DEBUG] Searching by tag:', tag);
    // タグを検索ワードにセット
    this.searchTerm = '';
    
    // 選択されたタグをジャンルとして設定
    this.selectedGenres = [tag];
    
    // ジャンルの表示状態を更新
    this.genres.forEach(genre => {
      genre.active = genre.genre === tag;
    });
    
    // 検索を実行
    this.executeSearch();
    
    // モーダルを閉じる
    this.closeSelectedManga();
  }

  openPurchaseLink(manga: Manga): void {
    if (manga.affiliateUrl) {
      window.open(manga.affiliateUrl, '_blank');
    }
  }

  openPreviewLink(manga: Manga): void {
    if (manga.tachiyomiUrl) {
      window.open(manga.tachiyomiUrl, '_blank');
    }
  }

  // 検索結果を処理するメソッド
  handleSearchResults(event: MangaSearchResultEvent) {
    console.log('[MangaViewer] handleSearchResults受信データ:', event);
    console.log('[MangaViewer] event.results:', event.results);

    // 検索語・ジャンルも親で同期
    this.searchTerm = event.searchTerm;
    this.selectedGenres = [...event.selectedGenres];

    // 表示用のジャンル名を設定
    if (this.selectedGenres.length > 0) {
      this.displayGenre = this.selectedGenres.join('、');
    } else if (this.searchTerm) {
      this.displayGenre = `"${this.searchTerm}"`;
    } else {
      this.displayGenre = '全て';
    }

    // ローディング状態を解除
    this.isLoading = false;
    this.isSearchResultMode = true;
    this.isSearchVisible = false;

    // 検索結果の前にリストをクリア
    this.allMangaList = [];
    this.mangaList = [];
    this.displayMangaList = [];
    this.currentOffset = 0;

    // 新着漫画にマークを付ける
    event.results.forEach(manga => {
      manga.isNew = this.isNewManga(manga);
    });

    // 検索結果のデータをセット（新しい参照で必ず上書き）
    this.allMangaList = [...event.results];
    this.mangaList = [...event.results];
    this.displayMangaList = [...event.results];
    console.log('[MangaViewer] mangaListセット:', this.allMangaList);

    // ページネーション状態をAPIレスポンスから反映
    this.nextCursor = event.nextCursor || null;
    this.hasMorePages = !!event.hasMore;
    console.log('[MangaViewer] ページネーション状態:', { 
      nextCursor: this.nextCursor, 
      hasMorePages: this.hasMorePages 
    });
    
    this.pagination = {
      hasNextPage: !!event.hasMore,
      hasPreviousPage: false
    };

    // 検索結果がある場合、現在の漫画を更新
    if (this.displayMangaList.length > 0) {
      this.currentManga = null;
      this.cdr.detectChanges();
      setTimeout(() => {
        // 検索結果の最初の漫画を選択状態にするが表示はしない
        // 実際の表示はselectMangaAndExitメソッドで行う
        this.currentIndex = 0;
        this.cdr.detectChanges();
        console.log('[MangaViewer] 現在の表示モード:', this.isSearchResultMode ? '検索結果モード' : '通常モード');
        console.log('[MangaViewer] 現在選択中の漫画:', this.currentManga);
      }, 0);
    } else {
      this.currentManga = null;
      this.cdr.detectChanges();
      console.log('[MangaViewer] 検索結果なし - 現在の漫画をクリア');
    }

    setTimeout(() => {
      if (!this.isSearchResultMode) {
        console.log('[MangaViewer] 検索結果モードが無効になっているため再設定');
        this.isSearchResultMode = true;
        this.cdr.detectChanges();
      }
      const contentElement = document.querySelector('.manga-content');
      if (contentElement) {
        contentElement.scrollTop = 0;
      }
      
      // インターセクションオブザーバーを再設定
      this.setupIntersectionObserver();
      
      console.log('[MangaViewer] 検索結果表示完了 - 最終状態:', { 
        searchMode: this.isSearchResultMode, 
        results: this.displayMangaList.length,
        hasMorePages: this.hasMorePages,
        nextCursor: this.nextCursor
      });
    }, 100);
  }
  
  // 新着漫画かどうかを判定する（7日以内に追加された漫画）
  private isNewManga(manga: Manga): boolean {
    if (!manga.createdAt) return false;
    
    const createdDate = new Date(manga.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= 7; // 7日以内なら新着
  }

  // インターセクションオブザーバーのセットアップ
  private setupIntersectionObserver(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    console.log('[DEBUG] Setting up intersection observer');
    
    // 前回のオブザーバーがあれば切断
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    // 新しいオブザーバーを作成
    const options = {
      root: null, // ビューポートをルートとして使用
      rootMargin: '50px', // 要素がビューポートの下部から50pxの位置に入ったら発火（より早めにトリガー）
      threshold: 0.01 // 1%が見えた時点でコールバックを実行
    };
    
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && this.hasMorePages && !this.isLoadingMore && this.isSearchResultMode) {
          console.log('[DEBUG] Scroll observer triggered, loading more manga');
          this.loadMoreData();
        }
      });
    }, options);
    
    // 監視対象の要素を登録（ビューの更新後）
    setTimeout(() => {
      try {
        if (this.scrollObserver && this.hasMorePages) {
          console.log('[DEBUG] Observing scroll element');
          this.intersectionObserver?.observe(this.scrollObserver.nativeElement);
        } else {
          console.log('[DEBUG] No scroll element found or no more pages available');
        }
      } catch (error) {
        console.error('[DEBUG] Error setting up scroll observer:', error);
      }
    }, 100);
    
    // スクロールイベントリスナーも追加してバックアップとして機能させる
    try {
      // 既存のリスナーを削除
      const searchResultsContainer = document.querySelector('.search-results-container');
      if (searchResultsContainer) {
        console.log('[DEBUG] Setting up scroll event listener on search results container');
        
        // スクロールハンドラ関数を定義
        const scrollHandler = () => {
          if (this.isLoadingMore || !this.hasMorePages || !this.isSearchResultMode) {
            return;
          }
          
          const container = searchResultsContainer as HTMLElement;
          const scrollPosition = container.scrollTop + container.clientHeight;
          const scrollHeight = container.scrollHeight;
          
          // スクロール位置が下部に近づいたら追加データをロード
          // 閾値を減らして早めにロードを開始（スクロール位置が下部から150px以内に近づいたら）
          if (scrollHeight - scrollPosition < 150) {
            console.log('[DEBUG] Scroll event triggered, loading more manga');
            console.log('[DEBUG] Scroll metrics:', {
              scrollTop: container.scrollTop,
              clientHeight: container.clientHeight,
              scrollHeight: scrollHeight,
              position: scrollPosition,
              remaining: scrollHeight - scrollPosition
            });
            this.loadMoreData();
          }
        };
        
        // 既存のリスナーを削除
        searchResultsContainer.removeEventListener('scroll', scrollHandler);
        
        // 新しいリスナーを追加
        searchResultsContainer.addEventListener('scroll', scrollHandler);
        console.log('[DEBUG] Scroll event listener added');
      } else {
        console.log('[DEBUG] Search results container not found');
        
        // フォールバック：documentのスクロールイベントを使用
        const documentScrollHandler = () => {
          if (this.isLoadingMore || !this.hasMorePages || !this.isSearchResultMode) {
            return;
          }
          
          const scrollPosition = window.scrollY + window.innerHeight;
          const scrollHeight = document.body.scrollHeight;
          
          // スクロール位置が下部に近づいたら追加データをロード
          if (scrollHeight - scrollPosition < 150) {
            console.log('[DEBUG] Document scroll event triggered, loading more manga');
            this.loadMoreData();
          }
        };
        
        // 既存のリスナーを削除して再設定
        window.removeEventListener('scroll', documentScrollHandler);
        window.addEventListener('scroll', documentScrollHandler);
        console.log('[DEBUG] Document scroll event listener added as fallback');
      }
    } catch (error) {
      console.error('[DEBUG] Error setting up scroll event listeners:', error);
    }
  }
  
  // サーバーから追加データをロード
  loadMoreData(): void {
    console.log('[DEBUG] loadMoreData called, isLoadingMore:', this.isLoadingMore);
    if (this.isLoadingMore) return; // 重複実行防止
    
    // nextCursorがないのに呼び出された場合は終了
    if (!this.nextCursor || !this.hasMorePages) {
      console.log('[DEBUG] No next cursor or hasMorePages is false - cannot load more data');
      return;
    }
    
    // カーソル情報の整合性チェック
    if (!this.nextCursor.lastId || !this.nextCursor.lastUpdatedAt) {
      console.warn('[DEBUG] Next cursor has missing properties:', this.nextCursor);
      // 最低限の情報を設定（空でも処理できるようにサーバー側で対応する必要あり）
      if (!this.nextCursor.lastId) this.nextCursor.lastId = '';
      if (!this.nextCursor.lastUpdatedAt) this.nextCursor.lastUpdatedAt = '';
    }
    
    // ローディング状態を表示
    this.isLoadingMore = true;
    this.cdr.detectChanges();
    
    console.log('[DEBUG] Next cursor to be used:', JSON.stringify(this.nextCursor));
    
    // 少し遅延を入れてUIが反応する時間を確保
    setTimeout(() => {
      console.log('[DEBUG] Fetching more data with next page');
      this.fetchNextPage();
    }, 100);
  }

  // 表示用リストを更新
  updateDisplayMangaList() {
    this.displayMangaList = this.allMangaList.slice(this.currentOffset, this.currentOffset + this.PAGE_SIZE);
  }

  // 次のページへ
  nextPage() {
    // すでに取得済みのデータがあればスライスだけ
    if (this.currentOffset + this.PAGE_SIZE < this.allMangaList.length) {
      this.currentOffset += this.PAGE_SIZE;
      this.updateDisplayMangaList();
      if (this.displayMangaList.length > 0) {
        this.currentIndex = 0;
        this.updateCurrentManga(this.displayMangaList[0]);
      }
    } else if (this.hasMorePages && !this.isLoadingMore) {
      // まだAPIで取得していない場合はAPI呼び出し
      this.fetchNextPage();
    }
  }

  // 前のページへ
  previousPage() {
    if (this.currentOffset - this.PAGE_SIZE >= 0) {
      this.currentOffset -= this.PAGE_SIZE;
      this.updateDisplayMangaList();
      if (this.displayMangaList.length > 0) {
        this.currentIndex = 0;
        this.updateCurrentManga(this.displayMangaList[0]);
      }
    }
  }

  // ページネーションAPIレスポンス処理
  private handlePaginatedResponse(response: PaginatedResponse<Manga>, isInitialSearch = false): void {
    console.log('[MangaViewer] handlePaginatedResponse called');
    console.log('[MangaViewer] Response data count:', response.data?.length || 0);
    console.log('[MangaViewer] Has more:', response.hasMore);
    console.log('[MangaViewer] Is initial search:', isInitialSearch);
    console.log('[MangaViewer] Next cursor:', response.nextCursor ? JSON.stringify(response.nextCursor) : 'null');

    // レスポンスデータがない場合は終了
    if (!response || !response.data || response.data.length === 0) {
      console.log('[MangaViewer] No data in response');
      this.isLoading = false;
      this.isLoadingMore = false;
      this.cdr.detectChanges();
      return;
    }

    // 初期検索の場合、全データとカーソル情報をリセット
    if (isInitialSearch) {
      console.log('[MangaViewer] Initial search - Resetting data and cursor');
      this.allMangaList = [...response.data];
      this.mangaList = [...response.data];
      this.displayMangaList = [...response.data];
      
      // 次ページカーソルをDeep Copyして保存
      if (response.nextCursor) {
        this.nextCursor = {
          lastId: response.nextCursor.lastId || '',
          lastUpdatedAt: response.nextCursor.lastUpdatedAt || ''
        };
        
        // Deep Copyした現在のカーソルを保存
        this.currentCursor = {
          lastId: response.nextCursor.lastId || '',
          lastUpdatedAt: response.nextCursor.lastUpdatedAt || ''
        };
        
        this.cursorHistory = [{
          lastId: response.nextCursor.lastId || '',
          lastUpdatedAt: response.nextCursor.lastUpdatedAt || ''
        }];
      } else {
        this.currentCursor = null;
        this.nextCursor = null;
        this.cursorHistory = [];
      }
      
      // さらにデータがあるかのフラグを設定
      this.hasMorePages = !!response.hasMore;
      
      console.log('[MangaViewer] After reset - Current cursor:', this.currentCursor ? JSON.stringify(this.currentCursor) : 'null');
      console.log('[MangaViewer] After reset - Next cursor:', this.nextCursor ? JSON.stringify(this.nextCursor) : 'null');
      console.log('[MangaViewer] After reset - Has more pages:', this.hasMorePages);
    } else {
      // 続きのデータ取得の場合
      console.log('[MangaViewer] Loading more data - Appending data');
      
      // 重複チェック（fanzaIdを元に判断）
      const existingFanzaIds = new Set(this.allMangaList.map(manga => manga.fanzaId));
      const newData = response.data.filter(manga => !existingFanzaIds.has(manga.fanzaId));
      
      console.log('[MangaViewer] Existing data count:', this.allMangaList.length);
      console.log('[MangaViewer] New unique data count:', newData.length);
      console.log('[MangaViewer] Filtered duplicates:', response.data.length - newData.length);
      
      if (newData.length > 0) {
        // 新しいデータを追加
        this.allMangaList = [...this.allMangaList, ...newData];
        this.mangaList = [...this.mangaList, ...newData];
        
        // 現在表示中の要素数を数える
        const currentlyDisplayed = this.displayMangaList.length;
        
        // 現在のページに表示するべき残りのアイテム数を計算
        const remainingNeeded = this.PAGE_SIZE - currentlyDisplayed;
        
        // 足りない分を新しいデータから追加
        if (remainingNeeded > 0 && newData.length > 0) {
          const itemsToAdd = newData.slice(0, remainingNeeded);
          this.displayMangaList = [...this.displayMangaList, ...itemsToAdd];
        }
        
        // 次ページカーソルをDeep Copyして保存
        if (response.nextCursor) {
          // 現在のカーソルを履歴に追加
          if (response.nextCursor.lastId && response.nextCursor.lastUpdatedAt) {
            this.currentCursor = {
              lastId: response.nextCursor.lastId,
              lastUpdatedAt: response.nextCursor.lastUpdatedAt
            };
            
            // カーソル情報が重複しないように確認してから追加
            const cursorExists = this.cursorHistory.some(cursor => 
              cursor.lastId === this.currentCursor?.lastId && 
              cursor.lastUpdatedAt === this.currentCursor?.lastUpdatedAt
            );
            
            if (!cursorExists && this.currentCursor) {
              this.cursorHistory.push({...this.currentCursor});
            }
            
            // 次のカーソルを設定
            this.nextCursor = {
              lastId: response.nextCursor.lastId,
              lastUpdatedAt: response.nextCursor.lastUpdatedAt
            };
            
            console.log('[MangaViewer] Updated cursor history - length:', this.cursorHistory.length);
            console.log('[MangaViewer] Updated current cursor:', JSON.stringify(this.currentCursor));
            console.log('[MangaViewer] Updated next cursor:', JSON.stringify(this.nextCursor));
          } else {
            console.warn('[MangaViewer] Next cursor has missing properties:', response.nextCursor);
          }
        } else {
          // 次のページがない場合
          this.nextCursor = null;
          console.log('[MangaViewer] No more pages available - next cursor set to null');
        }
        
        // さらにデータがあるかのフラグを設定（APIレスポンスから直接更新）
        this.hasMorePages = !!response.hasMore;
        console.log('[MangaViewer] Updated has more pages flag:', this.hasMorePages);
      } else {
        console.log('[MangaViewer] No new unique data to add');
        // 新しいデータがなくても次のカーソルが提供されている場合は更新
        if (response.nextCursor && response.nextCursor.lastId && response.nextCursor.lastUpdatedAt) {
          this.nextCursor = {
            lastId: response.nextCursor.lastId,
            lastUpdatedAt: response.nextCursor.lastUpdatedAt
          };
          console.log('[MangaViewer] Updated next cursor despite no new data:', JSON.stringify(this.nextCursor));
        } else {
          // 新しいデータもないし次のカーソルもない場合はもうページングを終了
          this.hasMorePages = false;
          console.log('[MangaViewer] No more pages available - setting hasMorePages to false');
        }
      }
    }

    // データ取得済みの場合、読み込み中フラグを解除
    this.isLoading = false;
    this.isLoadingMore = false;
    
    // 表示リストを更新
    this.updateDisplayMangaList();
    
    // 変更検知を強制
    this.cdr.detectChanges();
  }

  // レスポンスデータのログ出力用ヘルパーメソッド
  private logResponseData(response: PaginatedResponse<Manga>): void {
    if (!response || !response.data) {
      console.log('[DEBUG] レスポンスデータがありません');
      return;
    }
    
    if (response.data.length === 0) {
      console.log('[DEBUG] レスポンスデータは空配列です');
      return;
    }
    
    console.log('[DEBUG] 取得データ件数:', response.data.length);
    console.log('[DEBUG] 取得データの最初のID:', response.data[0].fanzaId);
    console.log('[DEBUG] 取得データの最後のID:', response.data[response.data.length - 1].fanzaId);
    
    if (response.nextCursor) {
      console.log('[DEBUG] 次ページカーソル情報:', JSON.stringify(response.nextCursor));
    } else {
      console.log('[DEBUG] 次ページカーソル情報: なし');
    }
    
    console.log('[DEBUG] さらにデータあり:', response.hasMore);
  }

  // fetchPreviousPageメソッドの代わりにリダイレクト用メソッドを追加
  private fetchPreviousPage(): void {
    this.previousPage();
  }
}
