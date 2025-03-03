import axios from 'axios';

const API_BASE_URL = 'https://api.dmm.com/affiliate/v3/ItemList';

/**
 * FANZA API に対して漫画データを取得する関数
 * @param {string} keyword - 検索キーワード
 * @param {string} offset - 結果の開始位置
 * @returns {Promise<Array>} 変換後の漫画データ配列
 */
export async function fetchMangaList(keyword = '', offset = '1') {
  // 環境変数から API ID とアフィリエイト ID を取得
  const apiId = process.env['FANZA_API_ID'];
  const affiliateId = process.env['FANZA_AFFILIATE_ID'];

  if (!apiId || !affiliateId) {
    throw new Error('API認証情報が設定されていません');
  }

  const params = {
    api_id: apiId,
    affiliate_id: affiliateId,
    site: 'FANZA',
    service: 'ebook',
    floor: 'comic',
    hits: '100',
    offset,
    keyword,
    output: 'json'
  };

  try {
    const response = await axios.get(API_BASE_URL, { params });
    const baseOffset = parseInt(offset, 10) || 1;
    return transformApiResponse(response.data, baseOffset);
  } catch (error: any) {
    // エラーを再スロー
    throw new Error(`漫画データの取得に失敗しました: ${error.message}`);
  }
}

/**
 * FANZA API のレスポンスから必要な項目を抽出
 * @param {object} data - FANZA API のレスポンスデータ
 * @param {number} baseOffset - オフセット基準値
 * @returns {Array} 整形された漫画データ配列
 */
export function transformApiResponse(data: any, baseOffset: number): any[] {
  if (!data?.result?.items) {
    return [];
  }
  
  return data.result.items.map((item: any, index: number) => {
    // サンプル画像URLを抽出
    const sampleImages = item.sampleImageURL ? [
      item.sampleImageURL.sample_s?.image,
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
