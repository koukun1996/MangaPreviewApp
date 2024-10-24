export interface Manga {
  title: string;
  imageUrl: string;
  affiliateUrl: string;
  contentId: string;
  sampleImageUrls: string[];
  tachiyomiUrl?: string;
}

export interface ApiResponse {
  result: {
    items: [{
      title: string;
      affiliateURL: string;
      content_id: string;
      imageURL: {
        list: string;
        small: string;
        large: string;
      };
      tachiyomi: {
        URL: string;
        affiliateURL: string;
      };
    }];
    status: number;
    total_count: number;
    first_position: number;
  };
}