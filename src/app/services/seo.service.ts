import { Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, map, mergeMap } from 'rxjs/operators';
import { Manga } from '../models/manga.interface';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  // サイトのベースURLを環境設定から取得
  private baseUrl = environment.siteUrl;
  private siteName = environment.siteName;
  private siteDescription = environment.siteDescription;

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

    // タイトル設定 - サイト名を前に出してSEO強化
    const pageTitle = `エロ漫画立ち読み市 - ${manga.title} | ${manga.author}作品`;
    this.updateTitle(pageTitle);

    // 説明文の生成（サニタイズ処理を含む）
    const description = this.createDescription(manga);
    
    // キーワードの生成（タグから）- サイト名を含める
    const keywords = `エロ漫画立ち読み市, ${manga.title}, ${manga.author}, ${manga.tags ? manga.tags.join(', ') : ''}`;

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

    // 追加のSEOメタタグ
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });
    this.meta.updateTag({ name: 'author', content: manga.author });
    
    // 構造化データ (JSON-LD) の追加
    this.addJsonLdSchema(manga);
    
    // BreadcrumbList構造化データも追加
    this.addBreadcrumbSchema(manga);
  }

  // 漫画説明文を作成
  private createDescription(manga: Manga): string {
    // サイト名を必ず含める
    let elements = ['エロ漫画立ち読み市で'];
    
    if (manga.title) {
      elements.push(`「${manga.title}」`);
    }
    
    if (manga.author) {
      elements.push(`${manga.author}先生の作品`);
    }
    
    if (manga.tags && manga.tags.length > 0) {
      elements.push(`ジャンル: ${manga.tags.slice(0, 5).join('、')}`);
    }
    
    // 立ち読みできる点を強調
    elements.push('を無料で立ち読みできます');
    
    if (manga.description) {
      // 説明文は短く切り詰める
      const shortDesc = manga.description.substring(0, 80) + (manga.description.length > 80 ? '...' : '');
      elements.push(shortDesc);
    }
    
    // 最大文字数を制限（SEO的に最適な長さに調整）
    let description = elements.join(' ');
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
    const existingScript = document.querySelector('script[type="application/ld+json"][id="manga-schema"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    // CreativeWorkスキーマを使用
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      'name': manga.title,
      'headline': `エロ漫画立ち読み市 - ${manga.title}`,
      'author': {
        '@type': 'Person',
        'name': manga.author
      },
      'publisher': {
        '@type': 'Organization',
        'name': 'エロ漫画立ち読み市',
        'url': this.baseUrl
      },
      'description': manga.description || `${manga.title} - ${manga.author}による作品を立ち読みできます。`,
      'image': manga.thumbnailUrl || manga.sampleImageUrls?.[0] || '',
      'datePublished': manga.createdAt,
      'dateModified': manga.updatedAt,
      'genre': manga.tags,
      'keywords': manga.tags ? manga.tags.join(', ') : '',
      'inLanguage': 'ja',
      'url': `${this.baseUrl}/manga/${manga.fanzaId}`
    };
    
    // JSONをスクリプトタグとして追加
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'manga-schema';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  // パンくずリスト構造化データを追加
  addBreadcrumbSchema(manga: Manga): void {
    // 既存のJSON-LDスクリプトがあれば削除
    const existingScript = document.querySelector('script[type="application/ld+json"][id="breadcrumb-schema"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    // BreadcrumbListスキーマ
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'エロ漫画立ち読み市',
          'item': this.baseUrl
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': manga.author,
          'item': `${this.baseUrl}/author/${encodeURIComponent(manga.author)}`
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': manga.title,
          'item': `${this.baseUrl}/manga/${manga.fanzaId}`
        }
      ]
    };
    
    // JSONをスクリプトタグとして追加
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'breadcrumb-schema';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  // タグページ用のメタ情報を設定
  setTagPageMeta(tagName: string, count: number): void {
    const pageTitle = `エロ漫画立ち読み市 - ${tagName}の漫画一覧 (${count}件) | 無料立ち読み`;
    this.updateTitle(pageTitle);
    
    const description = `エロ漫画立ち読み市の${tagName}ジャンル漫画一覧。${count}件の作品を無料で立ち読みできます。人気作品や新着作品をお楽しみください。`;
    
    this.updateMetaTags({
      title: pageTitle,
      description: description,
      keywords: `エロ漫画立ち読み市, ${tagName}, 漫画, 同人誌, 立ち読み, 無料`,
      canonicalUrl: `/tag/${encodeURIComponent(tagName)}`
    });
    
    // 追加のSEOメタタグ
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });
    
    // タグページ用のJSON-LDスキーマを追加
    this.addTagPageSchema(tagName, count);
  }

  // 作者ページ用のメタ情報を設定
  setAuthorPageMeta(authorName: string, count: number): void {
    const pageTitle = `エロ漫画立ち読み市 - ${authorName}の作品一覧 (${count}件) | 無料立ち読み`;
    this.updateTitle(pageTitle);
    
    const description = `エロ漫画立ち読み市で${authorName}先生の漫画作品一覧。${count}件の作品を無料で立ち読みできます。人気作や最新作をチェック！`;
    
    this.updateMetaTags({
      title: pageTitle,
      description: description,
      keywords: `エロ漫画立ち読み市, ${authorName}, 漫画家, 作品一覧, 立ち読み, 無料`,
      canonicalUrl: `/author/${encodeURIComponent(authorName)}`
    });
    
    // 追加のSEOメタタグ
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });
    this.meta.updateTag({ name: 'author', content: authorName });
    
    // 作者ページ用のJSON-LDスキーマを追加
    this.addAuthorPageSchema(authorName, count);
  }
  
  // タグページ用のJSON-LDスキーマを追加
  addTagPageSchema(tagName: string, count: number): void {
    // 既存のJSON-LDスクリプトがあれば削除
    const existingScript = document.querySelector('script[type="application/ld+json"][id="tag-schema"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    // CollectionPageスキーマ
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': `${tagName}の漫画一覧 - エロ漫画立ち読み市`,
      'description': `${tagName}ジャンルの漫画作品一覧です。全${count}件の作品を無料で立ち読みできます。`,
      'publisher': {
        '@type': 'Organization',
        'name': 'エロ漫画立ち読み市',
        'url': this.baseUrl
      },
      'url': `${this.baseUrl}/tag/${encodeURIComponent(tagName)}`,
      'keywords': `${tagName}, 漫画, 立ち読み, 無料`,
      'numberOfItems': count,
      'inLanguage': 'ja'
    };
    
    // JSONをスクリプトタグとして追加
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'tag-schema';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
    
    // パンくずリストのスキーマも追加
    this.addTagBreadcrumbSchema(tagName);
  }
  
  // 作者ページ用のJSON-LDスキーマを追加
  addAuthorPageSchema(authorName: string, count: number): void {
    // 既存のJSON-LDスクリプトがあれば削除
    const existingScript = document.querySelector('script[type="application/ld+json"][id="author-schema"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    // CollectionPageスキーマとPersonスキーマの組み合わせ
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': `${authorName}の作品一覧 - エロ漫画立ち読み市`,
      'description': `${authorName}先生の漫画作品一覧です。全${count}件の作品を無料で立ち読みできます。`,
      'publisher': {
        '@type': 'Organization',
        'name': 'エロ漫画立ち読み市',
        'url': this.baseUrl
      },
      'mainEntity': {
        '@type': 'Person',
        'name': authorName,
        'jobTitle': '漫画家'
      },
      'url': `${this.baseUrl}/author/${encodeURIComponent(authorName)}`,
      'keywords': `${authorName}, 漫画家, 作品一覧, 立ち読み, 無料`,
      'numberOfItems': count,
      'inLanguage': 'ja'
    };
    
    // JSONをスクリプトタグとして追加
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'author-schema';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
    
    // パンくずリストのスキーマも追加
    this.addAuthorBreadcrumbSchema(authorName);
  }
  
  // タグページ用のパンくずリストスキーマを追加
  addTagBreadcrumbSchema(tagName: string): void {
    // 既存のJSON-LDスクリプトがあれば削除
    const existingScript = document.querySelector('script[type="application/ld+json"][id="tag-breadcrumb-schema"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    // BreadcrumbListスキーマ
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'エロ漫画立ち読み市',
          'item': this.baseUrl
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'タグ一覧',
          'item': `${this.baseUrl}/tags`
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': `${tagName}`,
          'item': `${this.baseUrl}/tag/${encodeURIComponent(tagName)}`
        }
      ]
    };
    
    // JSONをスクリプトタグとして追加
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'tag-breadcrumb-schema';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  }
  
  // 作者ページ用のパンくずリストスキーマを追加
  addAuthorBreadcrumbSchema(authorName: string): void {
    // 既存のJSON-LDスクリプトがあれば削除
    const existingScript = document.querySelector('script[type="application/ld+json"][id="author-breadcrumb-schema"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    // BreadcrumbListスキーマ
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'エロ漫画立ち読み市',
          'item': this.baseUrl
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': '作者一覧',
          'item': `${this.baseUrl}/authors`
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': `${authorName}`,
          'item': `${this.baseUrl}/author/${encodeURIComponent(authorName)}`
        }
      ]
    };
    
    // JSONをスクリプトタグとして追加
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'author-breadcrumb-schema';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  }
} 