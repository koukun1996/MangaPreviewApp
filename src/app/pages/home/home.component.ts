import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MangaViewerComponent } from '../../components/manga-viewer/manga-viewer.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MangaViewerComponent],
  template: `<app-manga-viewer></app-manga-viewer>`
})
export class HomeComponent {} 