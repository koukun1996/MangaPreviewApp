import { Component, OnInit, HostListener } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MangaService } from "../../services/manga.service";
import { Manga } from "../../models/manga.interface";
import { debounceTime, distinctUntilChanged, Subject } from "rxjs";
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AdultConfirmationDialogComponent } from "../AdultConfirmationDialogComponent/adult-confirmation-dialog.component";

@Component({
  selector: "app-manga-viewer",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: "./manga-viewer.component.html",
  styleUrls: ["./manga-viewer.component.scss", "../../../../src/custom-theme.scss"],
})
export class MangaViewerComponent implements OnInit {
  currentManga: Manga | null = null;
  mangaList: Manga[] = [];
  currentIndex = 0;
  // 現在のページ（offset）の保持。初期値は 1 です。
  currentOffset: number = 1;
  searchTerm = "";
  private searchSubject = new Subject<string>();
  isLoading = false;
  isSearchVisible = false;
  isMenuVisible = false;
  currentImageIndex = 0;
  isImageViewerVisible = false;
  isAdult = false;

  // スワイプ開始位置の保持
  private _swipeStart: Touch | null = null;
  private touchStartX = 0;
  private touchEndX = 0;

  constructor(private mangaService: MangaService, private dialog: MatDialog) {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((term) => {
        this.performSearch(term);
      });
  }

  ngOnInit(): void {
    // 成人確認ダイアログを開く
    const dialogRef = this.dialog.open(AdultConfirmationDialogComponent, {
      width: '300px',
      data: { message: 'あなたは18歳以上ですか？' },
      panelClass: 'custom-dialog-container'
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        window.location.href = 'https://www.google.com';
        return;
      }
  
      // 成人確認が取れた場合、URL のクエリパラメータから keyword を取得して漫画を読み込み
      const searchParams = new URLSearchParams(window.location.search);
      const keyword = searchParams.get("keyword") || "";
      this.searchTerm = keyword;
  
      // keyword がある場合はそのキーワードで読み込み、なければ通常の読み込みを行う
      this.loadManga(keyword);
    });
  }

  toggleMenu() {
    this.isMenuVisible = !this.isMenuVisible;
    document.body.style.overflow = this.isMenuVisible ? "hidden" : "";
  }

  closeMenu() {
    this.isMenuVisible = false;
    document.body.style.overflow = "";
  }

  toggleSearch() {
    this.isSearchVisible = !this.isSearchVisible;
    if (!this.isSearchVisible) {
      this.searchTerm = "";
      this.loadManga();
    }
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.searchSubject.next(this.searchTerm);
  }

  // 新規検索時は offset をリセットして API を呼び出す
  private performSearch(term: string) {
    this.isLoading = true;
    this.currentOffset = 1;
    this.mangaService.searchManga(term, this.currentOffset).subscribe({
      next: (mangaArray: Manga[]) => {
        this.mangaList = mangaArray;
        // 先頭要素に offset が付与されていれば currentOffset を更新
        if (mangaArray.length > 0 && mangaArray[0].offset) {
          this.currentOffset = mangaArray[0].offset;
        }
        this.currentIndex = 0;
        this.currentManga =
          this.mangaList.length > 0 ? this.mangaList[0] : null;
        this.currentImageIndex = 0;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error("エラーが発生しました:", error);
        this.isLoading = false;
      },
    });
  }

  // 初回ロードまたはキーワードなしの読み込み
  loadManga(keyword: string = "") {
    this.isLoading = true;
    this.mangaService.searchManga(keyword, this.currentOffset).subscribe({
      next: (mangaArray: Manga[]) => {
        this.mangaList = mangaArray;
        if (mangaArray.length > 0 && mangaArray[0].offset) {
          this.currentOffset = mangaArray[0].offset;
        }
        this.currentIndex = 0;
        this.currentManga =
          this.mangaList.length > 0 ? this.mangaList[0] : null;
        this.currentImageIndex = 0;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error("Error loading manga:", error);
        this.isLoading = false;
      },
    });
  }

  // ページ内の漫画を順次表示。末尾の場合は次ページを取得
  nextManga() {
    if (this.currentIndex < this.mangaList.length - 1) {
      this.currentIndex++;
      this.currentManga = this.mangaList[this.currentIndex];
      this.currentImageIndex = 0;
    } else {
      // 現在のページの末尾の場合、次ページを取得
      this.fetchNextPage();
    }
  }

  // ページ内の漫画を逆順で表示。先頭の場合は前ページを取得（offset は 1 未満にならない）
  previousManga() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.currentManga = this.mangaList[this.currentIndex];
      this.currentImageIndex = 0;
    } else if (this.currentOffset > 1) {
      this.fetchPreviousPage();
    }
  }

  // サーバーへ「次へ」指示。direction を 'next' として offset を更新
  fetchNextPage() {
    this.isLoading = true;
    this.mangaService
      .searchManga(this.searchTerm, this.currentOffset, "next")
      .subscribe({
        next: (mangaArray: Manga[]) => {
          this.mangaList = mangaArray;
          if (mangaArray.length > 0 && mangaArray[0].offset) {
            this.currentOffset = mangaArray[0].offset;
          }
          this.currentIndex = 0;
          this.currentManga =
            this.mangaList.length > 0 ? this.mangaList[0] : null;
          this.currentImageIndex = 0;
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error("Error fetching next page:", error);
          this.isLoading = false;
        },
      });
  }

  // サーバーへ「前へ」指示。direction を 'prev' として offset を更新
  fetchPreviousPage() {
    this.isLoading = true;
    this.mangaService
      .searchManga(this.searchTerm, this.currentOffset, "prev")
      .subscribe({
        next: (mangaArray: Manga[]) => {
          this.mangaList = mangaArray;
          if (mangaArray.length > 0 && mangaArray[0].offset) {
            this.currentOffset = mangaArray[0].offset;
          }
          this.currentIndex =
            this.mangaList.length > 0 ? this.mangaList.length - 1 : 0;
          this.currentManga =
            this.mangaList.length > 0
              ? this.mangaList[this.currentIndex]
              : null;
          this.currentImageIndex = 0;
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error("Error fetching previous page:", error);
          this.isLoading = false;
        },
      });
  }

  goToProduct() {
    if (this.currentManga?.affiliateUrl) {
      window.open(this.currentManga.affiliateUrl, "_blank");
    }
  }

  goToTachiyomi() {
    if (this.currentManga?.tachiyomiUrl) {
      window.open(this.currentManga.tachiyomiUrl, "_blank");
    }
  }

  nextImage() {
    if (this.currentManga?.sampleImageUrls) {
      this.currentImageIndex =
        (this.currentImageIndex + 1) %
        (this.currentManga.sampleImageUrls.length + 1);
    }
  }

  previousImage() {
    if (this.currentManga?.sampleImageUrls) {
      this.currentImageIndex =
        this.currentImageIndex === 0
          ? this.currentManga.sampleImageUrls.length
          : this.currentImageIndex - 1;
    }
  }

  getCurrentImage(): string {
    if (!this.currentManga) return "";
    if (this.currentImageIndex === 0) {
      return this.currentManga.imageUrl;
    }
    return this.currentManga.sampleImageUrls[this.currentImageIndex - 1];
  }

  onSwipe(event: TouchEvent, direction: "left" | "right") {
    const touch = event.changedTouches[0];
    if (!this._swipeStart) {
      this._swipeStart = touch;
      return;
    }
    const deltaX = touch.clientX - this._swipeStart.clientX;
    const threshold = 50;
    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && direction === "right") {
        this.previousImage();
      } else if (deltaX < 0 && direction === "left") {
        this.nextImage();
      }
    }
    this._swipeStart = null;
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipeGesture();
  }

  handleSwipeGesture() {
    const deltaX = this.touchEndX - this.touchStartX;
    const threshold = 50;
    if (Math.abs(deltaX) > threshold) {
      if (deltaX < 0) {
        this.nextManga();
      } else {
        this.previousManga();
      }
    }
  }
}
