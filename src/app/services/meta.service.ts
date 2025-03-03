import { Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class MetaService {
  constructor(
    private meta: Meta,
    private title: Title
  ) {}

  updateTitle(title: string) {
    this.title.setTitle(`${title} - MangaPreviewApp`);
  }

  updateMetaTags(config: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
  }) {
    const defaults = {
      title: 'MangaPreviewApp - 漫画プレビューサイト',
      description: '人気の漫画をプレビュー。最新の漫画情報をチェックできます。',
      image: '/assets/images/default-og-image.jpg',
      url: 'https://your-domain.com'
    };

    const meta = { ...defaults, ...config };

    this.meta.updateTag({ name: 'description', content: meta.description });
    
    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: meta.title });
    this.meta.updateTag({ property: 'og:description', content: meta.description });
    this.meta.updateTag({ property: 'og:image', content: meta.image });
    this.meta.updateTag({ property: 'og:url', content: meta.url });
    
    // Twitter Card
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: meta.title });
    this.meta.updateTag({ name: 'twitter:description', content: meta.description });
    this.meta.updateTag({ name: 'twitter:image', content: meta.image });
  }
} 