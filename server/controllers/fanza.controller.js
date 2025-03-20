const FanzaApiService = require('../services/fanzaApiService');
const Manga = require('../models/manga.model');

// FANZA API接続設定
const fanzaApiService = new FanzaApiService(
  process.env.FANZA_API_ID,
  process.env.FANZA_AFFILIATE_ID
);

/**
 * FANZA APIからのデータインポート
 */
exports.importFromFanza = async (req, res) => {
  try {
    // API認証情報チェック
    if (!fanzaApiService.isConfigured) {
      return res.status(503).json({
        error: 'FANZA API認証情報が設定されていません。.envファイルでFANZA_API_IDとFANZA_AFFILIATE_IDを設定してください。',
        dummyMode: true
      });
    }
    
    // リクエストボディが存在しない場合のデフォルト値を設定
    if (!req.body) {
      req.body = {};
    }
    
    const { keywords = [''], limit = 1 } = req.body;
    
    if (!Array.isArray(keywords)) {
      return res.status(400).json({ error: 'キーワードは配列で指定してください' });
    }
    
    // インポート結果の統計情報
    const stats = {
      totalKeywords: keywords.length,
      totalManga: 0,
      importedManga: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    // 各キーワードで検索して保存
    for (const keyword of keywords) {
      try {
        console.log(`キーワード "${keyword}" で検索中...`);
        const result = await fanzaApiService.searchManga({
          keyword,
          hits: 100,
          offset: 1,
          sort: 'rank'
        });
        
        stats.totalManga += result.result_count;
        console.log(`${result.result_count}件の漫画が見つかりました。`);
        
        // 各漫画情報をDBに保存
        for (const manga of result.items) {
          try {
            // 検索キーワードと組み合わせを生成
            const searchKeywords = generateKeywords(manga);
            const combinations = generateCombinations(manga);
            
            const mangaDoc = {
              ...manga,
              searchKeywords,
              combinations,
              lastUpdated: new Date()
            };
            
            // upsert操作で保存
            await Manga.updateOne(
              { fanzaId: manga.fanzaId },
              { $set: mangaDoc },
              { upsert: true }
            );
            
            stats.importedManga++;
          } catch (mangaError) {
            console.error(`漫画保存エラー:`, mangaError);
            stats.errors++;
          }
        }
        
        // APIの負荷軽減のため待機
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (keywordError) {
        console.error(`キーワード "${keyword}" の検索エラー:`, keywordError);
        stats.errors++;
      }
      
      // 指定された数のキーワードまで処理
      if (keywords.indexOf(keyword) >= limit - 1) {
        break;
      }
    }
    
    stats.endTime = Date.now();
    stats.duration = (stats.endTime - stats.startTime) / 1000;
    
    return res.status(200).json({
      success: true,
      message: 'インポート完了',
      stats
    });
    
  } catch (error) {
    console.error('FANZAからのインポートエラー:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * FANZA APIで漫画を検索
 */
exports.searchFanza = async (req, res) => {
  try {
    // API認証情報チェック
    if (!fanzaApiService.isConfigured) {
      console.warn('FANZA API認証情報が設定されていないため、ダミーデータを返します。');
      const dummyData = fanzaApiService.getDummyData(req.query.keyword);
      return res.status(200).json({
        ...dummyData,
        dummyMode: true,
        notice: 'これはAPIキーが設定されていないときに返されるダミーデータです。'
      });
    }
    
    const { 
      keyword = '', 
      offset = 1, 
      hits = 20,
      sort = 'rank',
      article = 'comic'
    } = req.query;
    
    const result = await fanzaApiService.searchManga({
      keyword,
      offset: parseInt(offset),
      hits: parseInt(hits),
      sort,
      article
    });
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('FANZA検索エラー:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 検索キーワードを生成する
 * @param {Object} manga 漫画データ
 * @returns {Array<string>} 検索キーワード
 */
function generateKeywords(manga) {
  if (!manga) {
    console.warn('generateKeywords: mangaオブジェクトがnullまたはundefinedです');
    return [];
  }
  
  const keywords = new Set();
  
  // タイトルを分割して追加
  if (manga.title) {
    manga.title.split(/\s+/).forEach(word => keywords.add(word.toLowerCase()));
  }
  
  // 作者を追加
  if (manga.author) {
    keywords.add(manga.author.toLowerCase());
  }
  
  // タグを追加
  if (Array.isArray(manga.tags)) {
    manga.tags.forEach(tag => {
      if (tag) keywords.add(tag.toLowerCase());
    });
  }
  
  return Array.from(keywords);
}

/**
 * 組み合わせを生成する
 * @param {Object} manga 漫画データ
 * @returns {Array<Array<string>>} 組み合わせ
 */
function generateCombinations(manga) {
  const result = [];
  
  if (!manga) {
    console.warn('generateCombinations: mangaオブジェクトがnullまたはundefinedです');
    return result;
  }
  
  if (!manga.author || !Array.isArray(manga.tags) || manga.tags.length === 0) {
    return result;
  }
  
  // 作者とタグの組み合わせ
  manga.tags.forEach(tag => {
    if (!tag) return;
    
    result.push([manga.author, tag]);
    
    // タグ同士の組み合わせ（2つずつ）
    manga.tags.forEach(secondTag => {
      if (!secondTag || tag === secondTag) return;
      
      // タグをアルファベット順にソートして重複を避ける
      const sortedTags = [tag, secondTag].sort();
      
      // 既存の組み合わせと重複していないか確認
      const exists = result.some(combo => 
        Array.isArray(combo) && 
        combo.length === 2 && 
        combo[0] === sortedTags[0] && 
        combo[1] === sortedTags[1]
      );
      
      if (!exists) {
        result.push(sortedTags);
      }
    });
  });
  
  return result;
}