import { NgModule } from '@angular/core';
import { RouterModule, Routes, ExtraOptions } from '@angular/router';
import { MangaViewerComponent } from './components/manga-viewer/manga-viewer.component';
import { HomeComponent } from './pages/home/home.component';
import { MangaDetailComponent } from './pages/manga-detail/manga-detail.component';

export const routes: Routes = [
  { 
    path: '', 
    component: HomeComponent, 
    pathMatch: 'full',
    data: { 
      title: 'エロ漫画立ち読み市',
      preload: true
    }
  },
  { 
    path: 'manga/:id', 
    component: MangaDetailComponent,
    data: {
      title: 'マンガ詳細 - エロ漫画立ち読み市',
      metaTags: {
        description: '漫画の詳細情報、サンプル画像を閲覧できます。'
      }
    }
  },
  { 
    path: 'tag/:tagName', 
    component: HomeComponent,
    data: {
      title: 'タグ別漫画一覧 - エロ漫画立ち読み市',
      metaTags: {
        description: '特定タグの漫画一覧を表示しています。'
      }
    }
  },
  { 
    path: 'author/:authorName', 
    component: HomeComponent,
    data: {
      title: '作者別漫画一覧 - エロ漫画立ち読み市',
      metaTags: {
        description: '特定作者の漫画一覧を表示しています。'
      }
    }
  },
  { 
    path: '**', 
    redirectTo: '' 
  }
];

const routerOptions: ExtraOptions = {
  initialNavigation: 'enabledBlocking',
  scrollPositionRestoration: 'enabled',
  anchorScrolling: 'enabled',
  useHash: false,
  enableTracing: false // デバッグ時はtrueに設定
};

@NgModule({
  imports: [RouterModule.forRoot(routes, routerOptions)],
  exports: [RouterModule]
})
export class AppRoutingModule { } 