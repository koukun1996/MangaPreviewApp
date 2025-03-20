require('dotenv').config();
const mongoose = require('mongoose');
const FanzaApiService = require('../services/fanzaApiService');
const Manga = require('../models/manga.model');

// 環境変数から設定を読み込み
const FANZA_API_ID = process.env.FANZA_API_ID;
const FANZA_AFFILIATE_ID = process.env.FANZA_AFFILIATE_ID;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:your_secure_password@localhost:27017/manga_preview';

// キーワードリスト（必要に応じて調整）
const KEYWORDS = [
  '', // 空のキーワードでランキング順の結果を取得
  '美少女',
  'ファンタジー',
  '学園',
  '恋愛',
  'BL',
  '百合',
  'SF',
  'ホラー',
  '歴史'
];

// FANZA APIサービスの初期化
const fanzaApiService = new FanzaApiService(FANZA_API_ID, FANZA_AFFILIATE_ID);

/**
 * 漫画情報を投入する
 */
async function importManga() {
  // MongoDBに接続
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB接続成功');
  } catch (err) {
    console.error('MongoDB接続エラー:', err);
    process.exit(1);
  }

  // 統計情報
  let totalImported = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  try {
    // キーワードごとに処理
    for (const keyword of KEYWORDS) {
      console.log(`キーワード "${keyword || '(人気順)'}" で検索中...`);
      
      // ページごとに処理（最大5ページまで）
      for (let offset = 1; offset <= 5; offset++) {
        try {
          const result = await fanzaApiService.searchManga({
            keyword,
            offset: (offset - 1) * 100 + 1,
            hits: 100,
            sort: keyword ? 'rank' : 'rank'
          });
          
          console.log(`${result.items.length}件の漫画情報を取得しました`);
          
          if (result.items.length === 0) {
            break; // 結果がなければ次のキーワードへ
          }

          // データをMongoDBに保存
          for (const item of result.items) {
            try {
              // 検索キーワードと組み合わせを生成
              const searchKeywords = generateKeywords(item);
              const combinations = generateCombinations(item);
              
              const mangaDoc = {
                ...item,
                searchKeywords,
                combinations,
                lastUpdated: new Date()
              };

              // upsert操作（存在すれば更新、なければ作成）
              await Manga.updateOne(
                { fanzaId: item.fanzaId },
                { $set: mangaDoc },
                { upsert: true }
              );
              
              totalImported++;
            } catch (itemError) {
              console.error(`アイテム保存エラー:`, itemError);
              totalErrors++;
            }
          }
          
          // APIの負荷を抑えるため少し待機
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (pageError) {
          console.error(`ページ ${offset} 取得エラー:`, pageError);
          totalErrors++;
        }
      }
    }
    
    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;
    
    console.log('======================================');
    console.log(`処理完了！`);
    console.log(`- 保存した漫画: ${totalImported}件`);
    console.log(`- エラー: ${totalErrors}件`);
    console.log(`- 処理時間: ${durationSeconds}秒`);
    console.log('======================================');
    
  } catch (error) {
    console.error('インポート処理でエラーが発生しました:', error);
  } finally {
    // MongoDBの接続を閉じる
    await mongoose.disconnect();
    console.log('MongoDB接続を終了しました');
  }
}

/**
 * 検索キーワードを生成する
 * @param {Object} manga 漫画データ
 * @returns {Array<string>} 検索キーワード
 */
function generateKeywords(manga) {
  const keywords = new Set();
  
  // タイトルを分割して追加
  manga.title.split(/\s+/).forEach(word => keywords.add(word.toLowerCase()));
  
  // 作者を追加
  if (manga.author) {
    keywords.add(manga.author.toLowerCase());
  }
  
  // タグを追加
  if (manga.tags) {
    manga.tags.forEach(tag => keywords.add(tag.toLowerCase()));
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
  
  if (!manga.author || !manga.tags || manga.tags.length === 0) {
    return result;
  }
  
  // 作者とタグの組み合わせ
  manga.tags.forEach(tag => {
    result.push([manga.author, tag]);
    
    // タグ同士の組み合わせ（2つずつ）
    manga.tags.forEach(secondTag => {
      if (tag !== secondTag) {
        // タグをアルファベット順にソートして重複を避ける
        const sortedTags = [tag, secondTag].sort();
        const combination = sortedTags.join('|');
        
        // 既存の組み合わせと重複していないか確認
        const exists = result.some(combo => 
          combo.length === 2 && 
          combo[0] === sortedTags[0] && 
          combo[1] === sortedTags[1]
        );
        
        if (!exists) {
          result.push(sortedTags);
        }
      }
    });
  });
  
  return result;
}

// スクリプトを実行
importManga().catch(err => {
  console.error('エラーが発生しました:', err);
  process.exit(1);
}); 