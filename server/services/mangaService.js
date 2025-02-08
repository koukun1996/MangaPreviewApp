const axios = require('axios');

const API_BASE_URL = 'https://api.dmm.com/affiliate/v3/ItemList';

/**
 * FANZA API に対して漫画データを取得する関数
 * @param {string} keyword - 検索キーワード（空の場合は全件または意図した結果になる）
 * @param {string} [offset='1'] - 結果の開始位置（文字列として渡す）
 * @returns {Promise<Array>} 変換後の漫画データ配列
 */
async function fetchMangaList(keyword = '', offset = '1') {
  const apiId = process.env.FANZA_API_ID;
  const affiliateId = process.env.FANZA_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    console.error('環境変数が不足しています。', { FANZA_API_ID: apiId, FANZA_AFFILIATE_ID: affiliateId });
    throw new Error('環境変数に API ID またはアフィリエイトID が設定されていません');
  }

  const params = {
    api_id: apiId,
    affiliate_id: affiliateId,
    site: 'FANZA',
    service: 'ebook',
    floor: 'comic',
    hits: '100',
    offset: offset,
    keyword: keyword,
    output: 'json'
  };

  try {
    const response = await axios.get(API_BASE_URL, { params });
    const baseOffset = parseInt(offset, 10) || 1;
    const transformed = transformApiResponse(response.data, baseOffset);
    return transformed;
  } catch (error) {
    console.error('【fetchMangaList】FANZA APIから漫画取得中にエラー:', error.response?.data || error.message);
    throw new Error('漫画データの取得に失敗しました');
  }
}

/**
 * FANZA API のレスポンスを受け取り、必要なフィールドだけを抽出して Manga オブジェクトの配列を生成する
 * @param {object} data - FANZA API のレスポンスデータ
 * @param {number} baseOffset - オフセットの基準値
 * @returns {Array} Manga オブジェクトの配列
 */
function transformApiResponse(data, baseOffset) {
  if (!data?.result?.items) {
    console.warn('【transformApiResponse】data.result.items が存在しません。');
    return [];
  }
  return data.result.items.map((item, index) => {
    const manga = {
      title: item.title,
      affiliateUrl: item.affiliateURL || "",
      contentId: item.content_id || "",
      imageUrl: item.imageURL?.large || "",
      tachiyomiUrl: item.tachiyomi ? (item.tachiyomi.affiliateURL || item.tachiyomi.URL || "") : "",
      sampleImageUrls: item.sampleImageURL ? [
        item.sampleImageURL.sample_s?.image,
        item.sampleImageURL.sample_l?.image
      ].filter(url => !!url) : [],
      // リクエストで指定された baseOffset から順に各漫画に offset を付与
      offset: baseOffset + index
    };
    return manga;
  });
}

// ★ エクスポートする際、fetchMangaList をオブジェクトとしてエクスポートすることが重要 ★
module.exports = {
  fetchMangaList
};
