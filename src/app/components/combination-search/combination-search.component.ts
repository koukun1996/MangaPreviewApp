import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DbService } from '../../services/db.service';
import { MangaDocument } from '../../models/manga.interface';

@Component({
  selector: 'app-combination-search',
  templateUrl: './combination-search.component.html',
  styleUrls: ['./combination-search.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class CombinationSearchComponent implements OnInit {
  popularCombinations: {combination: string[], count: number}[] = [];
  allCombinations: string[][] = [];
  filteredCombinations: string[][] = [];
  searchTerm: string = '';
  searchResults: MangaDocument[] = [];
  selectedCombination: string[] = [];
  isLoading = false;
  currentPage = 1;
  itemsPerPage = 10;

  constructor(private dbService: DbService) { }

  ngOnInit(): void {
    this.loadPopularCombinations();
    this.loadAllCombinations();
  }

  // 人気の組み合わせを読み込む
  loadPopularCombinations(): void {
    this.isLoading = true;
    this.dbService.getPopularCombinations(20).subscribe({
      next: (combinations) => {
        this.popularCombinations = combinations;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('人気の組み合わせ取得エラー', error);
        this.isLoading = false;
      }
    });
  }

  // すべての組み合わせを読み込む
  loadAllCombinations(): void {
    this.dbService.getCombinations().subscribe({
      next: (combinations) => {
        this.allCombinations = combinations;
        this.filteredCombinations = combinations;
      },
      error: (error) => {
        console.error('組み合わせ取得エラー', error);
      }
    });
  }

  // 検索語句でフィルタリング
  filterCombinations(term: string): void {
    this.searchTerm = term;
    if (!term) {
      this.filteredCombinations = this.allCombinations;
    } else {
      this.filteredCombinations = this.allCombinations.filter(combo => 
        combo.some(tag => tag.toLowerCase().includes(term.toLowerCase()))
      );
    }
  }

  // 選択された組み合わせかどうか確認
  isSelectedCombination(combo: string[]): boolean {
    if (!this.selectedCombination || !combo) return false;
    if (this.selectedCombination.length !== combo.length) return false;
    return this.selectedCombination.every((val, idx) => val === combo[idx]);
  }

  // 組み合わせを選択
  selectCombination(combination: string[]): void {
    this.selectedCombination = combination;
    this.searchByCombination(combination);
  }

  // 組み合わせで検索
  searchByCombination(combination: string[]): void {
    this.isLoading = true;
    this.searchResults = [];
    this.currentPage = 1;

    this.dbService.searchByCombination(combination).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('組み合わせ検索エラー', error);
        this.isLoading = false;
      }
    });
  }

  // ページネーション用のゲッター
  get totalPages(): number {
    return Math.ceil(this.searchResults.length / this.itemsPerPage);
  }

  get paginatedResults(): MangaDocument[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.searchResults.slice(startIndex, startIndex + this.itemsPerPage);
  }

  // ページを変更
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // ページネーションの表示用配列
  get pageNumbers(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }
} 