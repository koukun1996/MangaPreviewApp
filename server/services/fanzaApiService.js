const axios = require('axios');
const querystring = require('querystring');

// FANZA API設定
const FANZA_API_BASE_URL = 'https://api.dmm.com/affiliate/v3';
const FANZA_API_PATHS = {
  itemList: '/ItemList'
};

/**
 * FANZA APIサービス
 */
class FanzaApiService {
  constructor(apiId, affiliateId) {
    this.apiId = apiId;
    this.affiliateId = affiliateId;
    
    // プレースホルダーチェック
    if (!apiId || !affiliateId) {
      console.error('警告: FANZA API認証情報が設定されていません。.envファイルを確認してください。');
      this.isConfigured = false;
    } else {
      this.isConfigured = true;
      console.log('FANZA API認証情報が設定されました:', { apiId, affiliateId });
    }
    
    this.defaultParams = {
      api_id: this.apiId,
      affiliate_id: this.affiliateId,
      output: 'json',
      version: '3'
    };
  }

  /**
   * 電子書籍（漫画）を検索
   * @param {Object} options 検索オプション
   * @returns {Promise<Object>} 検索結果
   */
  async searchManga(options = {}) {
    // 設定が不完全な場合はエラーを返す
    if (!this.isConfigured) {
      console.error('FANZA API認証情報が設定されていません。');
      throw new Error('FANZA API認証情報が設定されていません。.envファイルでFANZA_API_IDとFANZA_AFFILIATE_IDを設定してください。');
    }
    
    const params = {
      ...this.defaultParams,
      site: 'FANZA',
      service: 'digital',
      floor: 'comic',
      hits: options.hits || 100,
      offset: options.offset || 1,
      sort: options.sort || 'rank',
      keyword: options.keyword || '',
      article: options.article || 'comic',
      article_id: options.article_id || '',
      exclude_article_id: options.exclude_article_id || '',
      cid: options.cid || '',
      author: options.author || ''
    };

    try {
      const response = await axios.get(`${FANZA_API_BASE_URL}${FANZA_API_PATHS.itemList}?${querystring.stringify(params)}`);
      
      if (response.status === 200 && response.data && response.data.result && response.data.result.items) {
        return this.mapApiResponseToManga(response.data);
      } else {
        console.error('FANZA API エラー: 無効なレスポンス形式', response.data);
        return { items: [], total_count: 0, result_count: 0 };
      }
    } catch (error) {
      console.error('FANZA API 呼び出しエラー:', error.message);
      return this.getDummyData(options.keyword);
    }
  }

  /**
   * API レスポンスを Manga 形式にマッピング
   * @param {Object} apiResponse API レスポンス
   * @returns {Object} マッピングされた結果
   */
  mapApiResponseToManga(apiResponse) {
    const result = apiResponse.result;
    const items = result.items.map(item => {
      const apiItem = item.item || item;
      
      // サンプル画像URLの取得
      const sampleImageUrls = [];
      if (apiItem.sampleImageURL && apiItem.sampleImageURL.sample_s) {
        Object.values(apiItem.sampleImageURL.sample_s).forEach(url => {
          if (url) sampleImageUrls.push(url);
        });
      }

      // 立ち読みURLの取得
      let tachiyomiUrl = '';
      if (apiItem.tachiyomi && apiItem.tachiyomi.URL) {
        tachiyomiUrl = apiItem.tachiyomi.URL;
      }

      // タグの取得
      const tags = [];
      if (apiItem.genre) {
        apiItem.genre.forEach(genre => {
          if (genre.name) tags.push(genre.name);
        });
      }

      return {
        fanzaId: apiItem.content_id || '',
        title: apiItem.title || '',
        author: apiItem.author || '',
        price: apiItem.prices && apiItem.prices.price ? parseInt(apiItem.prices.price) : 0,
        thumbnailUrl: apiItem.imageURL && apiItem.imageURL.large ? apiItem.imageURL.large : '',
        tags: tags,
        description: apiItem.explanation || '',
        affiliateUrl: apiItem.affiliateURL || '',
        tachiyomiUrl: tachiyomiUrl,
        sampleImageUrls: sampleImageUrls,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    return {
      items: items,
      total_count: result.total_count || 0,
      result_count: items.length
    };
  }

  /**
   * API認証エラー時用のダミーデータを生成
   */
  getDummyData(keyword = '') {
    console.log('ダミーデータを生成しています。キーワード:', keyword);
    const items = [];
    
    // 10件のダミーデータを生成
    for (let i = 1; i <= 10; i++) {
      items.push({
        fanzaId: `dummy-${i}`,
        title: `ダミー漫画 ${i} ${keyword ? `「${keyword}」` : ''}`,
        author: 'サンプル作者',
        price: 500,
        thumbnailUrl: `https://picsum.photos/200/300?random=${i}`,
        tags: ['サンプル', 'ダミー', keyword].filter(Boolean),
        description: 'これはAPIキーが設定されていないときに表示されるダミーデータです。',
        affiliateUrl: 'https://example.com',
        tachiyomiUrl: 'https://example.com/tachiyomi',
        sampleImageUrls: [
          `https://picsum.photos/200/300?random=${i}`,
          `https://picsum.photos/200/300?random=${i+100}`
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return {
      items: items,
      total_count: 100,
      result_count: items.length
    };
  }
}

module.exports = FanzaApiService; 