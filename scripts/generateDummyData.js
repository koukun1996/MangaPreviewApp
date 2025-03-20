require('dotenv').config();
const mongoose = require('mongoose');
const FanzaApiService = require('../server/services/fanzaApiService');

// MongoDBに接続
const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:your_secure_password@localhost:27017/manga_preview?authSource=admin';

// mongooseの設定
mongoose.set('strictQuery', false);

/**
 * カスタムダミーデータを生成する関数
 */
function generateCustomDummyData(keyword, startIndex) {
  console.log(`ダミーデータを生成しています。キーワード: ${keyword}`);
  const items = [];
  
  // 10件のダミーデータを生成
  for (let i = 1; i <= 10; i++) {
    const uniqueId = startIndex + i;
    items.push({
      fanzaId: `dummy-${keyword}-${uniqueId}`,
      title: `ダミー漫画 「${keyword}」 ${i}`,
      author: 'サンプル作者',
      price: 500,
      thumbnailUrl: `https://picsum.photos/200/300?random=${uniqueId}`,
      tags: ['サンプル', 'ダミー', keyword].filter(Boolean),
      description: `これは「${keyword}」ジャンルのサンプル漫画です。`,
      affiliateUrl: 'https://example.com',
      tachiyomiUrl: 'https://example.com/tachiyomi',
      sampleImageUrls: [
        `https://picsum.photos/200/300?random=${uniqueId}`,
        `https://picsum.photos/200/300?random=${uniqueId+100}`
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  return items;
}

/**
 * ダミーデータを生成して保存する
 */
async function generateAndSaveDummyData() {
  try {
    // MongoDB接続
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB接続成功');

    // Mangaモデルのインポート
    const Manga = require('../server/models/manga.model');

    // 既存のデータを削除
    await Manga.deleteMany({});
    console.log('既存のデータを削除しました');

    // ダミーデータを生成
    const keywords = ['恋愛', 'ファンタジー', 'アクション', 'SF', '青春'];
    let totalCount = 0;

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      const startIndex = i * 10;
      
      // カスタムダミーデータ生成
      const dummyItems = generateCustomDummyData(keyword, startIndex);
      console.log(`キーワード "${keyword}" のダミーデータを生成: ${dummyItems.length}件`);

      // 検索キーワードと組み合わせを生成
      for (const manga of dummyItems) {
        // generateKeywords と generateCombinations 関数を実装
        const searchKeywords = generateKeywords(manga);
        const combinations = generateCombinations(manga);

        // Mangaオブジェクトを作成して保存
        const mangaDoc = new Manga({
          ...manga,
          searchKeywords,
          combinations,
          lastUpdated: new Date()
        });

        await mangaDoc.save();
        totalCount++;
      }
    }

    console.log(`合計 ${totalCount} 件のダミーデータを作成しました`);
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    // 接続を閉じる
    await mongoose.connection.close();
    console.log('MongoDB接続を閉じました');
  }
}

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

// スクリプト実行
generateAndSaveDummyData(); 