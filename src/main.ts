import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { MangaViewerComponent } from './app/components/manga-viewer/manga-viewer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MangaViewerComponent],
  template: `
    <app-manga-viewer></app-manga-viewer>
  `
})
export class App {}

bootstrapApplication(App, {
  providers: [
    provideHttpClient()
  ]
});