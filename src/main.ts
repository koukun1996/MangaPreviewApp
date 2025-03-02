import 'zone.js';
import { Component, OnInit, NgZone, Inject, PLATFORM_ID } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { MangaViewerComponent } from './app/components/manga-viewer/manga-viewer.component';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { importProvidersFrom } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AdultConfirmationDialogComponent } from './app/components/AdultConfirmationDialogComponent/adult-confirmation-dialog.component';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MangaViewerComponent, MatDialogModule, AdultConfirmationDialogComponent],
  template: `
    <app-manga-viewer></app-manga-viewer>
  `
})
export class App implements OnInit {
  constructor(
    private dialog: MatDialog,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    console.log('[DEBUG] App Component constructed');
  }
  
  ngOnInit() {
    console.log('[DEBUG] App Component initialized');
    
    if (isPlatformBrowser(this.platformId)) {
      console.log('[DEBUG] Browser environment in App Component');
      
      // NgZoneの外で実行して、変更検知の問題を回避
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          // NgZoneの中で実行して変更検知を確実に行う
          this.ngZone.run(() => {
            console.log('[DEBUG] Attempting to open dialog from App Component');
            this.showAdultConfirmation();
          });
        }, 1000);
      });
    }
  }
  
  showAdultConfirmation() {
    try {
      const dialogRef = this.dialog.open(AdultConfirmationDialogComponent, {
        width: '300px',
        data: { message: 'あなたは18歳以上ですか？' },
        disableClose: true
      });
      
      console.log('[DEBUG] Dialog opened from App Component');
      
      dialogRef.afterClosed().subscribe(result => {
        console.log('[DEBUG] Dialog closed with result:', result);
        if (!result) {
          window.location.href = 'https://www.google.com';
        }
      });
    } catch (error) {
      console.error('[ERROR] Failed to open dialog from App Component:', error);
    }
  }
}

bootstrapApplication(App, {
  providers: [
    importProvidersFrom(BrowserModule),
    provideHttpClient(),
    provideAnimations(),
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        hasBackdrop: true,
        disableClose: true,
        width: '300px'
      }
    }
  ]
});