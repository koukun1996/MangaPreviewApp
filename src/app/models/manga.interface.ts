export interface Manga {
  fanzaId: string;
  title: string;
  author: string;
  price: number;
  thumbnailUrl: string;
  tags: string[];
  genres?: Genre[];
  description: string;
  affiliateUrl: string;
  tachiyomiUrl: string;
  createdAt: Date;
  updatedAt: Date;
  offset?: number;
  sampleImageUrls?: string[];
}

// ジャンル情報の型定義
export interface Genre {
  name: string;
  id: string;
}

// API の各アイテムの型定義
export interface ApiResponseItem {
  title: string;
  affiliateURL: string;
  content_id: string;
  sampleImageURLs: string[];
  imageURL: {
    list: string;
    small: string;
    large: string;
  };
  genre?: Genre[];
  // tachiyomi が存在しない可能性があるため、オプショナルにします
  tachiyomi?: {
    URL?: string;
    affiliateURL?: string;
  };
}

export interface ApiResponse {
  result: {
    items: ApiResponseItem[];
    status: number;
    total_count: number;
    first_position: number;
  };
}

// MongoDB用のスキーマ
export interface MangaDocument extends Manga {
  _id?: string;
  searchKeywords: string[];
  combinations: string[][];
  lastUpdated: Date;
}
