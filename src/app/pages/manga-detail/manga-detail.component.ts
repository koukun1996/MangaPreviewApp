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
        this.loadMangaDetails(id);
      } else {
        this.error = 'マンガIDが見つかりません';
        this.isLoading = false;
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
        this.manga = data;
        this.isLoading = false;
        
        // SEO最適化：メタタグと構造化データを設定
        this.seoService.setMangaDetailMeta(data);
        
        // 関連する漫画を取得
        this.loadRelatedManga(data);
      },
      error: (err) => {
        console.error('Failed to load manga details:', err);
        this.error = '漫画情報の読み込みに失敗しました。';
        this.isLoading = false;
      }
    });
  }

  loadRelatedManga(manga: Manga): void {
    if (!manga.tags || manga.tags.length === 0) {
      return;
    }

    // 最大3つのタグを選択
    const selectedTags = manga.tags.slice(0, 3);
    
    this.mangaService.getRecommendations(
      [], // genres
      selectedTags, // tags
      [], // authors
      [manga.fanzaId], // excludeIds
      null, // cursor
      6 // limit
    ).subscribe({
      next: (response) => {
        this.relatedManga = response.data;
      },
      error: (err) => {
        console.error('Failed to load related manga:', err);
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