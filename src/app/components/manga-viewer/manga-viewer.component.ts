import { Component, OnInit, HostListener, PLATFORM_ID, Inject, AfterViewInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { CommonModule, isPlatformBrowser, isPlatformServer } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MangaService, PagingCursor, PaginatedResponse } from "../../services/manga.service";
import { Manga } from "../../models/manga.interface";
import { debounceTime, distinctUntilChanged, Subject } from "rxjs";
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AdultConfirmationDialogComponent } from "../AdultConfirmationDialogComponent/adult-confirmation-dialog.component";
import { ActivatedRoute, Router } from '@angular/router';
import { SeoService } from '../../services/seo.service';

interface GenreItem {
  genre: string;
  count: number;
  active?: boolean;
}

@Component({
  selector: "app-manga-viewer",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, AdultConfirmationDialogComponent],
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
  private searchSubject = new Subject<string>();
  isLoading = false;
  isSearchVisible = false;
  currentImageIndex = 0;
  isAdult = true; // デフォルトで成人と想定
  isSidebarVisible = false; // サイドバー表示状態の管理

  // カスタムダイアログ用の状態
  showCustomDialog = false;

  // スワイプ開始位置の保持
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
  private scrollTimeout: any;
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
    /* 検索ボタン対応のため、自動検索機能を無効化
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(term => {
        if (term.trim() !== "") {
          this.performSearch(term);
        }
      });
    */
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
        if (this.mangaId) {
          this.loadMangaData(this.mangaId);
        }
      } else {
        this.loadLatestManga();
      }
    });

    // ページネーションの初期化
    this.initPagination();
    
    // 成人確認の状態を確認
    this.checkAdultConfirmation();
    
    // ジャンル一覧を取得
    this.fetchGenres();
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
    }
  }

  ngOnDestroy() {
    if (this.headerTimeout) {
      clearTimeout(this.headerTimeout);
    }
  }

  // カスタムダイアログを表示
  showCustomAdultConfirmation(): void {
    console.log('[DEBUG] Showing custom adult confirmation dialog');
    this.showCustomDialog = true;
  }

  // 検索の表示/非表示を切り替え
  toggleSearch() {
    // すでに表示されている場合は非表示にする
    if (this.isSearchVisible) {
      this.isSearchVisible = false;
      this.isGenreListVisible = false;
    } else {
      // 非表示の場合は表示する
      this.isSearchVisible = true;
      // PC版では自動的にジャンルリストも表示
      this.isGenreListVisible = !this.isMobileDevice;
    }
  }

  // 検索を隠す
  hideSearch() {
    // 全てのデバイスで検索オーバーレイを閉じる
    this.isSearchVisible = false;
    this.isGenreListVisible = false;
  }

  // 検索入力時の処理
  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  // 検索の変更を処理
  onSearchChange(value: string) {
    console.log('[Client] 検索語を変更:', value);
    // キーワードの変更を記録するのみで、検索は実行しない
    this.searchTerm = value;
  }

  // 検索の実行
  public performSearch(term: string) {
    console.log('[Client] 検索を実行:', term);
    this.isLoading = true;
    this.isImageLoading = true;
    
    // カーソル情報をリセット
    this.currentCursor = null;
    this.nextCursor = null;
    this.cursorHistory = [];
    
    this.mangaService.searchManga(term).subscribe({
      next: (response) => {
        console.log('[Client] 検索結果:', response);
        this.mangaList = response.data || [];
        this.hasMorePages = response.hasMore;
        this.nextCursor = response.nextCursor;
        
        this.logCurrentStateDebug('[キーワード検索結果受信後]');
        
        if (this.mangaList.length > 0) {
          this.currentIndex = 0;
          // 一度nullにして確実に更新を発生させる
          this.currentManga = null;
          this.cdr.detectChanges(); // 変更を即時反映
          
          // 非同期で状態を更新してchangeDetectionを確実に発生させる
          setTimeout(() => {
            this.currentManga = {...this.mangaList[0]};  // オブジェクトを複製して新しい参照を作成
            this.currentImageIndex = 0;
            console.log('[Client] 検索で作品を表示:', this.currentManga?.title);
            this.preloadImages();
            this.isLoading = false;
            this.isImageLoading = false;
            this.cdr.detectChanges(); // 変更を即時反映
            this.logCurrentStateDebug('[キーワード検索結果表示完了]');
          }, 50);
        } else {
          this.currentManga = null;
          console.log('[Client] 検索で作品が見つかりませんでした');
          this.isLoading = false;
          this.isImageLoading = false;
          this.cdr.detectChanges(); // 変更を即時反映
          this.logCurrentStateDebug('[キーワード検索結果なし]');
        }
      },
      error: (error) => {
        this.mangaList = [];
        this.currentManga = null;
        this.handleError(error, '検索');
        this.isLoading = false;
        this.isImageLoading = false;
        this.cdr.detectChanges(); // 変更を即時反映
        this.logCurrentStateDebug('[キーワード検索エラー]');
      }
    });
  }

  // キーワードとジャンルを組み合わせた検索
  private performCombinedSearch(term: string, genres: string) {
    console.log(`[Client] 複合検索を実行: キーワード=${term}, ジャンル=${genres}`);
    
    this.isLoading = true;
    this.isImageLoading = true;
    
    // カーソル情報をリセット
    this.currentCursor = null;
    this.nextCursor = null;
    this.cursorHistory = [];
    
    this.mangaService.searchCombined(term, genres, null).subscribe({
      next: (response: PaginatedResponse<Manga>) => {
        console.log('[Client] 複合検索結果:', response);
        this.mangaList = response.data || [];
        this.hasMorePages = response.hasMore;
        this.nextCursor = response.nextCursor;
        
        if (this.mangaList.length > 0) {
          this.currentIndex = 0;
          // 一度nullにして確実に更新を発生させる
          this.currentManga = null;
          this.cdr.detectChanges(); // 変更を即時反映
          
          // 非同期で状態を更新してchangeDetectionを確実に発生させる
          setTimeout(() => {
            this.currentManga = {...this.mangaList[0]};  // オブジェクトを複製して新しい参照を作成
            this.currentImageIndex = 0;
            console.log('[Client] 複合検索で見つかった作品を表示:', this.currentManga?.title);
            this.preloadImages();
            this.isLoading = false;
            this.isImageLoading = false;
            this.cdr.detectChanges(); // 変更を即時反映
          }, 50);
        } else {
          this.currentManga = null;
          console.log('[Client] 複合検索で作品が見つかりませんでした');
          this.isLoading = false;
          this.isImageLoading = false;
          this.cdr.detectChanges(); // 変更を即時反映
        }
      },
      error: (error) => {
        console.error('[Client] 複合検索エラー:', error);
        this.handleError(error, '複合検索中');
        this.isLoading = false;
        this.isImageLoading = false;
        this.currentManga = null;
        this.cdr.detectChanges(); // 変更を即時反映
      }
    });
  }

  // 初回ロードまたはキーワードなしの読み込み
  loadManga(keyword: string = "") {
    this.isLoading = true;
    this.isImageLoading = true;
    console.log('[Client] 漫画読み込み開始:', keyword);
    
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
    if (this.currentIndex < this.mangaList.length - 1) {
      this.currentIndex++;
      this.updateCurrentManga(this.mangaList[this.currentIndex]);
    } else if (this.hasMorePages && this.nextCursor) {
      this.fetchNextPage();
    } else {
      console.log('[Client] これ以上の漫画はありません');
    }
  }

  // ページ内の漫画を逆順で表示。先頭の場合は前ページを取得
  previousManga() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateCurrentManga(this.mangaList[this.currentIndex]);
    } else if (this.cursorHistory.length > 0) {
      this.fetchPreviousPage();
    } else {
      console.log('[Client] 最初の漫画です');
    }
  }

  // サーバーへ「次へ」指示。カーソルベースのページング
  fetchNextPage() {
    this.isLoading = true;
    console.log('[DEBUG] fetchNextPage called with nextCursor:', this.nextCursor);
    
    if (!this.nextCursor || !this.nextCursor.lastId || !this.nextCursor.lastUpdatedAt) {
      console.log('[DEBUG] nextCursor is invalid:', this.nextCursor);
      this.isLoading = false;
      return;
    }
    
    // 現在のカーソルを履歴に保存（前ページに戻るため）
    if (this.currentCursor) {
      this.cursorHistory.push({...this.currentCursor});
    }
    
    // 次のページを取得
    this.mangaService
      .searchManga(this.searchTerm, this.nextCursor)
      .subscribe({
        next: (response: PaginatedResponse<Manga>) => {
          console.log('[DEBUG] fetchNextPage response:', response);
          
          if (response.data && response.data.length > 0) {
            // 現在のカーソルを更新
            this.currentCursor = {...this.nextCursor};
            // 次のカーソルを設定
            this.nextCursor = response.nextCursor;
            this.hasMorePages = response.hasMore;
            
            // データを更新
            this.mangaList = response.data;
            this.currentIndex = 0;
            this.updateCurrentManga(this.mangaList[0]);
            
            console.log('[DEBUG] Updated cursor:', this.currentCursor);
          } else {
            // 結果が空の場合
            console.log('[DEBUG] Empty response');
            this.hasMorePages = false;
            alert('これ以上のデータはありません');
          }
          
          this.isLoading = false;
        },
        error: (error) => {
          console.error('[DEBUG] Error in fetchNextPage:', error);
          this.handleError(error, "次のページの読み込み");
        }
      });
  }

  // サーバーへ「前へ」指示。カーソルベースのページング
  fetchPreviousPage() {
    this.isLoading = true;
    console.log('[DEBUG] fetchPreviousPage called');
    
    // 前のページのカーソルを取得
    if (this.cursorHistory.length === 0) {
      console.log('[DEBUG] No previous cursor available');
      this.isLoading = false;
      return;
    }
    
    const previousCursor = this.cursorHistory.pop();
    console.log('[DEBUG] Using previous cursor:', previousCursor);
    
    // 前のページを取得
    this.mangaService
      .searchManga(this.searchTerm, previousCursor)
      .subscribe({
        next: (response: PaginatedResponse<Manga>) => {
          console.log('[DEBUG] fetchPreviousPage response:', response);
          
          if (response.data && response.data.length > 0) {
            // 現在のカーソルを前のページのカーソルに設定
            this.currentCursor = previousCursor || null;
            // 次のカーソルを更新
            this.nextCursor = response.nextCursor;
            this.hasMorePages = response.hasMore;
            
            // データを更新
            this.mangaList = response.data;
            this.currentIndex = 0; // 前ページの先頭から表示
            this.updateCurrentManga(this.mangaList[this.currentIndex]);
            
            console.log('[DEBUG] Updated to previous page');
          } else {
            // 結果が空の場合
            console.log('[DEBUG] Empty response');
            alert('前のページはありません');
          }
          
          this.isLoading = false;
        },
        error: (error) => {
          console.error('[DEBUG] Error in fetchPreviousPage:', error);
          this.handleError(error, "前のページの読み込み");
        }
      });
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
    if (!isPlatformBrowser(this.platformId)) {
      console.log('[DEBUG] Not in browser environment');
      return;
    }
    
    console.log('[DEBUG] Current Manga:', JSON.stringify(this.currentManga, null, 2));
    console.log('[DEBUG] Tachiyomi URL:', this.currentManga?.tachiyomiUrl);
    if (this.currentManga?.tachiyomiUrl) {
      window.open(this.currentManga.tachiyomiUrl, "_blank");
    } else {
      console.log('[DEBUG] tachiyomiUrl is not set');
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
    if (!this.currentManga) return "";
    if (this.currentImageIndex === 0) {
      return this.currentManga.thumbnailUrl || "";
    }
    return this.currentManga.sampleImageUrls?.[this.currentImageIndex - 1] || this.currentManga.thumbnailUrl || "";
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.touchStartTime = Date.now();
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].clientX;
    this.touchEndY = event.changedTouches[0].clientY;
    const touchDuration = Date.now() - this.touchStartTime;

    // タップ判定
    const deltaX = Math.abs(this.touchEndX - this.touchStartX);
    const deltaY = Math.abs(this.touchEndY - this.touchStartY);

    if (deltaX < this.TAP_THRESHOLD && deltaY < this.TAP_THRESHOLD && touchDuration < this.TAP_DURATION) {
      // タップの場合は立ち読みページへ遷移
      // モバイルデバイスの場合のみイベント伝播を制御
      if (this.isMobileDevice) {
        event.preventDefault(); // デフォルトのイベント動作を防止
        event.stopPropagation(); // イベント伝播を停止
      }
      this.goToTachiyomi();
      return;
    }

    // スワイプ判定
    const swipeDistance = this.touchEndX - this.touchStartX;
    if (Math.abs(swipeDistance) > this.SWIPE_THRESHOLD) {
      if (swipeDistance > 0) {
        // 右スワイプで前のページへ
        this.previousManga();
      } else {
        // 左スワイプで次のページへ
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
    
    console.log('[Client] 漫画データを更新:', manga.title);
    // 一度nullにして強制的に更新を発生させる
    this.currentManga = null;
    this.isImageLoading = true;
    this.cdr.detectChanges(); // 変更を即時反映
    
    // 非同期で状態を更新してchangeDetectionを確実に発生させる
    setTimeout(() => {
      // オブジェクトを新たに複製して参照を変更し、確実にAngularの変更検出が働くようにする
      this.currentManga = {...manga};
      this.currentImageIndex = 0;
      this.preloadImages();
      this.isImageLoading = false;
      // 変更検出を明示的に実行
      this.cdr.detectChanges();
      this.logCurrentStateDebug('[漫画データ更新完了]');
    }, 50);
  }

  // 画像読み込み完了時の処理
  onImageLoad() {
    console.log('[Client] 画像の読み込みが完了しました', this.currentManga?.title);
    this.isImageLoading = false;
  }

  onImageError() {
    console.error('[DEBUG] 画像の読み込みに失敗しました');
    this.isImageLoading = false;
    
    // フォールバック画像を表示
    if (this.currentManga) {
      this.currentManga.thumbnailUrl = "assets/error-image.png";
    }
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
    
    // 修正された引数を渡す
    this.mangaService.getRecommendations(
      [], // genres - 空の配列または関連するジャンル
      tags, // tags - 選択されたタグ
      [], // authors - 空の配列または関連する作者
      excludeIds, // excludeIds - 現在の漫画IDを除外
      null, // cursor - ページングカーソル（この場合は不要）
      6 // limit - 取得件数
    ).subscribe({
      next: (response: PaginatedResponse<Manga>) => {
        console.log('[Client] レコメンデーション受信:', response);
        this.mangaList = response.data;
        this.hasMorePages = response.hasMore;
        this.nextCursor = response.nextCursor;

        this.currentIndex = 0;
        this.currentManga = null; // 一度nullにして確実に更新を発生させる
        this.cdr.detectChanges(); // 変更を即時反映

        setTimeout(() => {
          if (this.mangaList.length > 0) {
            this.currentManga = {...this.mangaList[0]};  // オブジェクトを複製して新しい参照を作成
            console.log('[Client] 類似の漫画を表示:', this.currentManga?.title);
          } else {
            this.currentManga = null;
            console.log('[Client] 類似の漫画が見つかりませんでした');
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

  // 検索ボタンクリック時の処理
  executeSearch() {
    console.log('[Client] 検索ボタンが押されました');
    
    // デバイスタイプに関わらず、常に検索オーバーレイとジャンル選択欄を閉じる
    this.isSearchVisible = false;
    this.isGenreListVisible = false;
    
    // 検索オーバーレイが確実に閉じるようにするため、表示状態をログ出力
    console.log('[Client] 検索オーバーレイの状態:', this.isSearchVisible);
    console.log('[Client] 検索条件 - キーワード:', this.searchTerm);
    console.log('[Client] 検索条件 - ジャンル:', this.selectedGenres);

    // デバッグ用に現在の状態を記録
    this.logCurrentStateDebug('[検索実行前]');

    // 現在の表示をクリアして検索中の状態を明確にする
    this.currentManga = null;
    this.mangaList = [];
    // 検索中の状態を設定
    this.isLoading = true;
    this.isImageLoading = true;
    
    // 検索実行
    if (this.selectedGenres.length > 0) {
      // ジャンルで検索
      if (this.searchTerm && this.searchTerm.trim() !== '') {
        // キーワードとジャンルの複合検索
        console.log('[Client] キーワードとジャンルの複合検索を実行します');
        this.performCombinedSearch(this.searchTerm, this.selectedGenres.join(','));
      } else {
        // ジャンルのみの検索
        console.log('[Client] ジャンルのみの検索を実行します');
        this.searchBySelectedGenres();
      }
    } else if (this.searchTerm && this.searchTerm.trim() !== '') {
      // キーワードのみで検索
      console.log('[Client] キーワードのみの検索を実行します');
      this.performSearch(this.searchTerm);
    } else {
      // 何も指定されていない場合は全件取得
      console.log('[Client] 検索条件なしの全件取得を実行します');
      this.loadManga();
    }
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
    
    // カーソル情報をリセット
    this.currentCursor = null;
    this.nextCursor = null;
    this.cursorHistory = [];

    // 複数ジャンルをカンマ区切りで送信
    const genresParam = this.selectedGenres.join(','); // 複数ジャンルをカンマ区切りに
    console.log('[Client] ジャンル検索を実行:', genresParam);
    
    this.mangaService.searchByGenre(genresParam, null).subscribe({
      next: (response: PaginatedResponse<Manga>) => {
        console.log('[Client] ジャンル検索結果:', response);
        this.mangaList = response.data || [];
        this.hasMorePages = response.hasMore;
        this.nextCursor = response.nextCursor;
        
        if (this.mangaList.length > 0) {
          this.currentIndex = 0;
          // 一度nullにして確実に更新を発生させる
          this.currentManga = null;
          this.cdr.detectChanges(); // 変更を即時反映
          
          // 非同期で状態を更新してchangeDetectionを確実に発生させる
          setTimeout(() => {
            this.currentManga = {...this.mangaList[0]};  // オブジェクトを複製して新しい参照を作成
            this.currentImageIndex = 0;
            console.log('[Client] ジャンル検索で見つかった作品を表示:', this.currentManga?.title);
            this.preloadImages();
            this.isLoading = false;
            this.isImageLoading = false;
            this.cdr.detectChanges(); // 変更を即時反映
          }, 50);
        } else {
          this.currentManga = null;
          console.log('[Client] ジャンル検索で作品が見つかりませんでした');
          this.isLoading = false;
          this.isImageLoading = false;
          this.cdr.detectChanges(); // 変更を即時反映
        }
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
}
