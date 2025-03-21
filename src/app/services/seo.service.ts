import { Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, map, mergeMap } from 'rxjs/operators';
import { Manga } from '../models/manga.interface';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  // サイトのベースURL
  private baseUrl = 'https://your-domain.com'; // 本番環境のURLに変更してください

  constructor(
    private meta: Meta,
    private title: Title,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    // ルート変更を監視し、データに基づいてタイトルとメタタグを更新
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.activatedRoute),
      map(route => {
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route;
      }),
      filter(route => route.outlet === 'primary'),
      mergeMap(route => route.data)
    ).subscribe(data => {
      if (data['title']) {
        this.updateTitle(data['title']);
      }
      
      if (data['metaTags']) {
        this.updateMetaTags(data['metaTags']);
      }
    });
  }

  // ページタイトルを更新
  updateTitle(title: string): void {
    this.title.setTitle(title);
  }

  // 基本的なメタタグを更新
  updateMetaTags(tags: any): void {
    // 説明文
    if (tags.description) {
      this.meta.updateTag({ name: 'description', content: tags.description });
      this.meta.updateTag({ property: 'og:description', content: tags.description });
    }

    // キーワード
    if (tags.keywords) {
      this.meta.updateTag({ name: 'keywords', content: tags.keywords });
    }

    // OGPタグ
    if (tags.title) {
      this.meta.updateTag({ property: 'og:title', content: tags.title });
    }

    if (tags.image) {
      this.meta.updateTag({ property: 'og:image', content: tags.image });
    }

    // canonical URL
    const canonicalUrl = tags.canonicalUrl || this.router.url;
    this.updateCanonicalUrl(this.baseUrl + canonicalUrl);
  }

  // 詳細ページのメタタグとJSON-LD構造化データを設定
  setMangaDetailMeta(manga: Manga): void {
    // マンガデータが無い場合は何もしない
    if (!manga) return;

    // タイトル設定
    const pageTitle = `${manga.title} - エロ漫画立ち読み市`;
    this.updateTitle(pageTitle);

    // 説明文の生成（サニタイズ処理を含む）
    const description = this.createDescription(manga);
    
    // キーワードの生成（タグから）
    const keywords = manga.tags ? manga.tags.join(', ') : '';

    // canonical URL
    const canonicalUrl = `/manga/${manga.fanzaId}`;

    // メタタグの更新
    this.updateMetaTags({
      title: pageTitle,
      description: description,
      keywords: keywords,
      image: manga.thumbnailUrl || manga.sampleImageUrls?.[0] || '',
      canonicalUrl: canonicalUrl
    });

    // OGPとTwitterカードタグの設定
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    this.meta.updateTag({ property: 'og:url', content: this.baseUrl + canonicalUrl });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    
    if (manga.thumbnailUrl || (manga.sampleImageUrls && manga.sampleImageUrls.length > 0)) {
      this.meta.updateTag({ name: 'twitter:image', content: manga.thumbnailUrl || (manga.sampleImageUrls ? manga.sampleImageUrls[0] : '') });
    }

    // 構造化データ (JSON-LD) の追加
    this.addJsonLdSchema(manga);
  }

  // 漫画説明文を作成
  private createDescription(manga: Manga): string {
    const elements = [];
    
    if (manga.title) {
      elements.push(manga.title);
    }
    
    if (manga.author) {
      elements.push(`作者: ${manga.author}`);
    }
    
    if (manga.tags && manga.tags.length > 0) {
      elements.push(`ジャンル: ${manga.tags.slice(0, 5).join('、')}`);
    }
    
    if (manga.description) {
      // 説明文は短く切り詰める
      const shortDesc = manga.description.substring(0, 100) + (manga.description.length > 100 ? '...' : '');
      elements.push(shortDesc);
    }
    
    // 最大文字数を制限（SEO的に最適な長さに調整）
    let description = elements.join('。 ');
    if (description.length > 160) {
      description = description.substring(0, 157) + '...';
    }
    
    return description;
  }

  // canonical URLを更新
  updateCanonicalUrl(url: string): void {
    // 既存のcanonicalタグがあれば削除
    const existingCanonicalTag = document.querySelector('link[rel="canonical"]');
    if (existingCanonicalTag) {
      existingCanonicalTag.remove();
    }
    
    // 新しいcanonicalタグを追加
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', url);
    document.head.appendChild(link);
  }

  // JSON-LD構造化データを追加
  addJsonLdSchema(manga: Manga): void {
    // 既存のJSON-LDスクリプトがあれば削除
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    // CreativeWorkスキーマを使用
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      'name': manga.title,
      'author': {
        '@type': 'Person',
        'name': manga.author
      },
      'description': manga.description || `${manga.title} - ${manga.author}による作品`,
      'image': manga.thumbnailUrl || manga.sampleImageUrls?.[0] || '',
      'datePublished': manga.createdAt,
      'dateModified': manga.updatedAt,
      'genre': manga.tags
    };
    
    // JSONをスクリプトタグとして追加
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  // タグページ用のメタ情報を設定
  setTagPageMeta(tagName: string, count: number): void {
    const pageTitle = `${tagName} の漫画一覧 (${count}件) - エロ漫画立ち読み市`;
    this.updateTitle(pageTitle);
    
    const description = `${tagName}ジャンルの漫画一覧です。${count}件の作品が見つかりました。`;
    
    this.updateMetaTags({
      title: pageTitle,
      description: description,
      keywords: `${tagName}, 漫画, 同人誌`,
      canonicalUrl: `/tag/${encodeURIComponent(tagName)}`
    });
  }

  // 作者ページ用のメタ情報を設定
  setAuthorPageMeta(authorName: string, count: number): void {
    const pageTitle = `${authorName} 作品一覧 (${count}件) - エロ漫画立ち読み市`;
    this.updateTitle(pageTitle);
    
    const description = `${authorName}による漫画作品一覧です。${count}件の作品が見つかりました。`;
    
    this.updateMetaTags({
      title: pageTitle,
      description: description,
      keywords: `${authorName}, 漫画家, 作品一覧`,
      canonicalUrl: `/author/${encodeURIComponent(authorName)}`
    });
  }
} 