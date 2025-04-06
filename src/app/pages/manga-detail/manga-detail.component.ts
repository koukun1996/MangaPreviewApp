import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MangaService } from '../../services/manga.service';
import { Manga } from '../../models/manga.interface';
import { SeoService } from '../../services/seo.service';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-manga-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './manga-detail.component.html',
  styleUrls: ['./manga-detail.component.scss']
})
export class MangaDetailComponent implements OnInit, OnDestroy {
  manga: Manga | null = null;
  isLoading = true;
  error: string | null = null;
  relatedManga: Manga[] = [];
  private routeSub: Subscription | null = null;
  sameAuthorManga: Manga[] = [];
  sameGenreManga: Manga[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mangaService: MangaService,
    private seoService: SeoService
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.routeSub = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        console.log(`[MangaDetailComponent] 漫画ID:${id}の詳細を読み込みます`);
        this.loadMangaDetails(id);
      } else {
        this.error = 'マンガIDが見つかりません';
        this.isLoading = false;
        console.error('[MangaDetailComponent] URLにマンガIDが指定されていません');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  loadMangaDetails(id: string): void {
    this.mangaService.getMangaById(id).subscribe({
      next: (data) => {
        if (!data || !data.fanzaId) {
          console.error(`[MangaDetailComponent] ID:${id}の漫画データが不完全です:`, data);
          this.error = '漫画情報の読み込みに失敗しました。データが見つかりません。';
          this.isLoading = false;
          return;
        }
        
        this.manga = data;
        this.isLoading = false;
        console.log(`[MangaDetailComponent] 漫画データを取得しました:`, data.title);
        
        // SEO最適化：メタタグと構造化データを設定
        this.seoService.setMangaDetailMeta(data);
        
        // 関連する漫画を取得
        this.loadRelatedManga(data);
      },
      error: (err) => {
        console.error('[MangaDetailComponent] 漫画詳細の読み込み中にエラーが発生しました:', err);
        this.error = '漫画情報の読み込みに失敗しました。サーバーが応答していないか、データが存在しません。';
        this.isLoading = false;
      }
    });
  }

  loadRelatedManga(manga: Manga): void {
    // 同じ作者の作品を取得
    this.loadSameAuthorManga(manga);
    
    // 同じジャンルの作品を取得
    this.loadSameGenreManga(manga);
  }

  /**
   * 同じ作者の作品を取得
   */
  loadSameAuthorManga(manga: Manga): void {
    if (!manga.author) {
      return;
    }

    // 作者名を検索条件として使用
    console.log(`[MangaDetailComponent] 同じ作者(${manga.author})の作品を検索`);
    
    const authors = [manga.author];
    
    this.mangaService.getRecommendations(
      [], // genres
      [], // tags
      authors, // authors
      [manga.fanzaId], // excludeIds - 現在の漫画は除外
      null, // cursor
      3 // limit - 最大3作品
    ).subscribe({
      next: (response) => {
        if (response.data && response.data.length > 0) {
          this.sameAuthorManga = response.data;
          console.log(`[MangaDetailComponent] 同じ作者の作品: ${this.sameAuthorManga.length}件`);
        } else {
          this.sameAuthorManga = [];
          console.log('[MangaDetailComponent] 同じ作者の作品は見つかりませんでした');
        }
      },
      error: (err) => {
        console.error('[MangaDetailComponent] 同じ作者の作品の取得に失敗:', err);
        this.sameAuthorManga = [];
      }
    });
  }

  /**
   * 同じジャンル/タグの作品を取得
   */
  loadSameGenreManga(manga: Manga): void {
    if (!manga.tags || manga.tags.length === 0) {
      return;
    }

    // 最大3つのタグを選択
    const selectedTags = manga.tags.slice(0, 3);
    console.log(`[MangaDetailComponent] 関連タグで作品を検索: ${selectedTags.join(', ')}`);
    
    this.mangaService.getRecommendations(
      [], // genres
      selectedTags, // tags
      [], // authors
      [manga.fanzaId], // excludeIds - 現在の漫画とすでに取得した同じ作者の作品を除外
      null, // cursor
      6 // limit - 最大6作品
    ).subscribe({
      next: (response) => {
        if (response.data && response.data.length > 0) {
          this.sameGenreManga = response.data;
          console.log(`[MangaDetailComponent] 同じジャンルの作品: ${this.sameGenreManga.length}件`);
        } else {
          this.sameGenreManga = [];
          console.log('[MangaDetailComponent] 同じジャンルの作品は見つかりませんでした');
        }
      },
      error: (err) => {
        console.error('[MangaDetailComponent] 同じジャンルの作品の取得に失敗:', err);
        this.sameGenreManga = [];
      }
    });
  }

  navigateToTag(tag: string): void {
    this.router.navigate(['/tag', tag]);
  }

  navigateToAuthor(author: string): void {
    this.router.navigate(['/author', author]);
  }

  openPurchaseLink(): void {
    if (this.manga?.affiliateUrl) {
      window.open(this.manga.affiliateUrl, '_blank');
    }
  }

  openPreviewLink(): void {
    if (this.manga?.tachiyomiUrl) {
      window.open(this.manga.tachiyomiUrl, '_blank');
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
} 