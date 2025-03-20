import axios from 'axios';
import MangaModel from '../models/manga.model';

const API_BASE_URL = 'https://api.dmm.com/affiliate/v3/ItemList';

// MongoDBドキュメントの型定義
interface MangaDocument {
  fanzaId: string;
  title: string;
  author: string;
  price: number;
  thumbnailUrl: string;
  tags: string[];
  description: string;
  affiliateUrl: string;
  tachiyomiUrl: string;
  sampleImageUrls: string[];
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

/**
 * 漫画データを取得する関数
 * まずMongoDBから検索し、見つからない場合はFANZA APIに問い合わせる
 * @param {string} keyword - 検索キーワード
 * @param {string} offset - 結果の開始位置
 * @returns {Promise<Array>} 変換後の漫画データ配列
 */
export async function fetchMangaList(keyword = '', offset = '1') {
  const offsetNum = parseInt(offset, 10) || 1;
  const limit = 20; // 1ページあたりの表示件数

  try {
    console.log(`📚 漫画データ取得開始: keyword=${keyword}, offset=${offsetNum}, limit=${limit}`);

    // MongoDBの接続確認
    try {
      const count = await MangaModel.estimatedDocumentCount();
      console.log(`📊 MongoDB内の漫画データ総数: ${count}件`);
    } catch (dbError) {
      console.error(`❌ MongoDBの接続チェックエラー:`, dbError);
    }

    // まずMongoDBから検索
    let mangaList: MangaDocument[] = [];
    if (keyword && keyword.trim() !== '') {
      // キーワード検索
      mangaList = await MangaModel.find({
        searchKeywords: { $in: [keyword.toLowerCase()] }
      })
      .sort({ updatedAt: -1 })
      .skip((offsetNum - 1) * limit)
      .limit(limit);
      
      console.log(`🔍 MongoDBからキーワード検索結果: ${mangaList.length}件`);
    } else {
      // 全件取得
      mangaList = await MangaModel.find()
      .sort({ updatedAt: -1 })
      .skip((offsetNum - 1) * limit)
      .limit(limit);
      
      console.log(`📖 MongoDBから全件取得: ${mangaList.length}件`);
    }

    if (mangaList.length === 0) {
      console.log(`⚠️ 漫画データが見つかりませんでした。空の配列を返します。`);
      return [];
    }

    // MongoDB結果をフロントエンド用に変換
    const transformedData = mangaList.map((manga: MangaDocument, index: number) => ({
      fanzaId: manga.fanzaId,
      title: manga.title || '',
      author: manga.author || '',
      price: manga.price || 0,
      thumbnailUrl: manga.thumbnailUrl || '',
      tags: manga.tags || [],
      description: manga.description || '',
      affiliateUrl: manga.affiliateUrl || '',
      tachiyomiUrl: manga.tachiyomiUrl || '',
      sampleImageUrls: manga.sampleImageUrls || [],
      offset: offsetNum + index,
      createdAt: manga.createdAt,
      updatedAt: manga.updatedAt
    }));

    console.log(`✅ データ変換完了: ${transformedData.length}件の漫画データを返します`);
    if (transformedData.length > 0) {
      console.log(`📕 最初の項目: ${transformedData[0].title}`);
    }

    return transformedData;

  } catch (error: any) {
    console.error(`❌ 漫画データの取得に失敗しました:`, error);
    // エラー時には空の配列を返す
    return [];
  }
}

/**
 * FANZA API のレスポンスから必要な項目を抽出（バックアップとして残す）
 */
export function transformApiResponse(data: any, baseOffset: number): any[] {
  if (!data?.result?.items) {
    return [];
  }
  
  return data.result.items.map((item: any, index: number) => {
    // サンプル画像URLを抽出
    const sampleImages = item.sampleImageURL ? [
      item.sampleImageURL.sample_l?.image
    ].filter(Boolean) : [];
    
    return {
      title: item.title || '',
      affiliateUrl: item.affiliateURL || '',
      contentId: item.content_id || '',
      imageUrl: item.imageURL?.large || '',
      tachiyomiUrl: item.tachiyomi ? (item.tachiyomi.affiliateURL || item.tachiyomi.URL || '') : '',
      sampleImageUrls: sampleImages,
      offset: baseOffset + index
    };
  });
}
