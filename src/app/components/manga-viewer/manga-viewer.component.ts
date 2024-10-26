import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MangaService } from '../../services/manga.service';
import { Manga } from '../../models/manga.interface';
import { SafeUrlPipe } from '../../pipes/safe-url.pipe';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-manga-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeUrlPipe],
  templateUrl: './manga-viewer.component.html',
  styleUrls: ['./manga-viewer.component.scss']
})
export class MangaViewerComponent implements OnInit {
  currentManga: Manga | null = null;
  mangaList: Manga[] = [];
  currentIndex = 0;
  searchTerm = '';
  private searchSubject = new Subject<string>();
  isLoading = false;
  isSearchVisible = false;
  isMenuVisible = false;
  currentImageIndex = 0;
  isImageViewerVisible = false;

  constructor(private mangaService: MangaService) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.performSearch(term);
    });
  }

  ngOnInit() {
    this.loadManga();
  }

  toggleMenu() {
    this.isMenuVisible = !this.isMenuVisible;
    if (this.isMenuVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeMenu() {
    this.isMenuVisible = false;
    document.body.style.overflow = '';
  }

  toggleSearch() {
    this.isSearchVisible = !this.isSearchVisible;
    if (!this.isSearchVisible) {
      this.searchTerm = '';
      if (this.searchTerm) {
        this.loadManga();
      }
    }
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.searchSubject.next(this.searchTerm);
  }

  private performSearch(term: string) {
    this.isLoading = true;
    this.mangaService.searchManga(term).subscribe({
      next: (manga) => {
        this.mangaList = manga;
        this.currentIndex = 0;
        if (manga.length > 0) {
          this.currentManga = manga[0];
          this.currentImageIndex = 0;
        } else {
          this.currentManga = null;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('エラーが発生しました:', error);
        this.isLoading = false;
      }
    });
  }

  loadManga(keyword: string = '') {
    this.isLoading = true;
    this.mangaService.searchManga(keyword).subscribe({
      next: (manga) => {
        this.mangaList = manga;
        if (manga.length > 0) {
          this.currentManga = manga[0];
          this.currentImageIndex = 0;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading manga:', error);
        this.isLoading = false;
      }
    });
  }

  nextManga() {
    if (this.currentIndex < this.mangaList.length - 1) {
      this.currentIndex++;
      this.currentManga = this.mangaList[this.currentIndex];
      this.currentImageIndex = 0;
    }
  }

  previousManga() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.currentManga = this.mangaList[this.currentIndex];
      this.currentImageIndex = 0;
    }
  }

  goToProduct() {
    if (this.currentManga?.affiliateUrl) {
      window.open(this.currentManga.affiliateUrl, '_blank');
    }
  }

  goToTachiyomi() {
    if (this.currentManga?.tachiyomiUrl) {
      window.open(this.currentManga.tachiyomiUrl, '_blank');
    }
  }

  showImageViewer() {
    if (this.currentManga?.imageUrl) {
      this.isImageViewerVisible = true;
    }
  }

  hideImageViewer() {
    this.isImageViewerVisible = false;
  }

  nextImage() {
    if (this.currentManga?.sampleImageUrls) {
      this.currentImageIndex = (this.currentImageIndex + 1) % (this.currentManga.sampleImageUrls.length + 1);
    }
  }

  previousImage() {
    if (this.currentManga?.sampleImageUrls) {
      this.currentImageIndex = this.currentImageIndex === 0 
        ? this.currentManga.sampleImageUrls.length 
        : this.currentImageIndex - 1;
    }
  }

  getCurrentImage(): string {
    if (!this.currentManga) return '';
    
    if (this.currentImageIndex === 0) {
      return this.currentManga.imageUrl;
    }
    return this.currentManga.sampleImageUrls[this.currentImageIndex - 1];
  }

  onSwipe(event: TouchEvent, direction: 'left' | 'right') {
    const touch = event.changedTouches[0];
    if (!this._swipeStart) {
      this._swipeStart = touch;
      return;
    }

    const deltaX = touch.clientX - this._swipeStart.clientX;
    const threshold = 50;

    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && direction === 'right') {
        this.previousImage();
      } else if (deltaX < 0 && direction === 'left') {
        this.nextImage();
      }
    }

    this._swipeStart = null;
  }

  private _swipeStart: Touch | null = null;
}