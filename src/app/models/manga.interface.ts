export interface Manga {
  title: string;
  imageUrl: string;
  affiliateUrl: string;
  contentId: string;
  sampleImageUrls: string[];
  tachiyomiUrl?: string;
  offset?: number;
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
