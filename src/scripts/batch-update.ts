import { MongoClient } from 'mongodb';
import { FanzaApiClient } from './fanza-api-client';
import { Manga } from '../app/models/manga.interface';
import * as dotenv from 'dotenv';

// .envファイルを読み込む
dotenv.config();

// 定数定義
const MONGODB_URI = process.env['MONGODB_URI'] || 'mongodb://admin:your_secure_password@localhost:27017/manga_preview?authSource=admin&directConnection=true';
const DATABASE_NAME = 'manga_preview';
const API_URL = process.env['API_URL'] || 'http://localhost:4000';
const BATCH_SIZE = 100; // 一度に挿入するドキュメント数

// コマンドライン引数を解析
const args = process.argv.slice(2);
const limitedMode = args.includes('--limited') || args.includes('-l');
const limitCount = (() => {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' || args[i] === '-c') {
      const count = parseInt(args[i + 1], 10);
      return isNaN(count) ? 100 : count;
    }
  }
  return 100; // デフォルト値
})();

/**
 * バッチ更新を実行する関数
 */
async function batchUpdate() {
  const client = new MongoClient(MONGODB_URI);
  const fanzaApi = new FanzaApiClient(API_URL);

  try {
    // MongoDBに接続
    await client.connect();
    console.log('MongoDBに接続しました');
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection('mangas');

    // 既存のデータを削除
    await collection.deleteMany({});
    console.log('既存のデータを削除しました。');

    // FANZA APIからデータを取得
    let mangaList: Manga[] = [];
    
    if (limitedMode) {
      // リミット処理：指定された件数のみ取得
      console.log(`限定モードが有効です。最大${limitCount}件のデータを取得します。`);
      mangaList = await fanzaApi.getLimitedManga(limitCount);
      console.log(`${mangaList.length}件のマンガデータが取得できました。`);
    } else {
      // 通常処理：全データを取得
      console.log('通常モードが有効です。すべてのデータを取得します。');
      mangaList = await fanzaApi.getAllManga();
      console.log(`${mangaList.length}件のマンガデータが取得できました。`);
    }
    
    // データ取得結果を処理
    if (mangaList.length === 0) {
      console.log('データが取得できませんでした。テストデータを使用します。');
      // テストデータを準備
      const testMangaList: Manga[] = [
        {
          fanzaId: "manga001",
          title: "ワンピース",
          author: "尾田栄一郎",
          price: 500,
          thumbnailUrl: "https://example.com/onepiece_thumb.jpg",
          tags: ["少年漫画", "冒険", "海賊"],
          description: "海賊王を目指す少年ルフィの冒険物語",
          affiliateUrl: "https://example.com/affiliate/onepiece",
          tachiyomiUrl: "https://example.com/tachiyomi/onepiece",
          createdAt: new Date(),
          updatedAt: new Date(),
          sampleImageUrls: ["https://example.com/onepiece/sample1.jpg", "https://example.com/onepiece/sample2.jpg"]
        },
        {
          fanzaId: "manga002",
          title: "鬼滅の刃",
          author: "吾峠呼世晴",
          price: 450,
          thumbnailUrl: "https://example.com/kimetsu_thumb.jpg",
          tags: ["少年漫画", "時代劇", "鬼"],
          description: "家族を殺された少年が鬼と戦う物語",
          affiliateUrl: "https://example.com/affiliate/kimetsu",
          tachiyomiUrl: "https://example.com/tachiyomi/kimetsu",
          createdAt: new Date(),
          updatedAt: new Date(),
          sampleImageUrls: ["https://example.com/kimetsu/sample1.jpg", "https://example.com/kimetsu/sample2.jpg"]
        },
        {
          fanzaId: "manga003",
          title: "進撃の巨人",
          author: "諫山創",
          price: 480,
          thumbnailUrl: "https://example.com/shingeki_thumb.jpg",
          tags: ["少年漫画", "ダーク", "巨人"],
          description: "巨人に支配された世界で生きる人類の物語",
          affiliateUrl: "https://example.com/affiliate/shingeki",
          tachiyomiUrl: "https://example.com/tachiyomi/shingeki",
          createdAt: new Date(),
          updatedAt: new Date(),
          sampleImageUrls: ["https://example.com/shingeki/sample1.jpg", "https://example.com/shingeki/sample2.jpg"]
        }
      ];
      
      // テストデータを挿入
      console.log('テストデータをMongoDBに挿入します。');
      await insertMangaListInBatches(collection, testMangaList, BATCH_SIZE);
    } else {
      // 取得したデータをMongoDBに挿入
      console.log(`${mangaList.length}件のマンガデータをMongoDBに挿入します。`);
      await insertMangaListInBatches(collection, mangaList, BATCH_SIZE);
    }

  } catch (error) {
    console.error('バッチ更新に失敗しました:', error);
  } finally {
    // MongoDBとの接続を終了
    await client.close();
    console.log('MongoDBとの接続を終了しました');
  }
}

/**
 * マンガリストをバッチ処理で挿入する関数
 * @param collection MongoDBのコレクション
 * @param mangaList マンガデータの配列
 * @param batchSize バッチサイズ
 */
async function insertMangaListInBatches(collection: any, mangaList: Manga[], batchSize: number) {
  console.log(`${mangaList.length}件のマンガデータをバッチ処理で挿入します...`);
  
  if (mangaList.length === 0) {
    console.log('データがありません。');
    return;
  }
  
  // データの一部をログ出力（デバッグ用）
  if (mangaList.length > 0) {
    const sampleManga = mangaList[0];
    console.log('保存するデータのサンプル（最初の1件）:');
    console.log('- タイトル:', sampleManga.title);
    console.log('- 著者:', sampleManga.author);
    console.log('- ジャンル数:', sampleManga.genres?.length || 0);
    console.log('- ジャンル情報:', JSON.stringify(sampleManga.genres, null, 2));
  }
  
  try {
    // データをバッチに分割
    const totalBatches = Math.ceil(mangaList.length / batchSize);
    console.log(`${totalBatches}バッチに分けて処理します（1バッチあたり最大${batchSize}件）...`);
    
    let insertedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < totalBatches; i++) {
      try {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, mangaList.length);
        const batch = mangaList.slice(start, end);
        
        console.log(`バッチ ${i+1}/${totalBatches} を処理中... (${start} - ${end-1})`);
        
        // バッチ内のドキュメントを挿入
        const bulkOps = batch.map((manga: Manga) => ({
          insertOne: {
            document: {
              ...manga,
              updatedAt: new Date() // 挿入時に現在の日付を設定
            }
          }
        }));
        
        const result = await collection.bulkWrite(bulkOps);
        insertedCount += result.insertedCount;
        console.log(`バッチ ${i+1}/${totalBatches} を挿入しました。挿入件数: ${result.insertedCount}`);
      } catch (error) {
        console.error(`バッチ ${i+1}/${totalBatches} の挿入中にエラーが発生しました:`, error);
        failedCount++;
        // エラーが発生しても処理を続行
        continue;
      }
      
      // 少し待機してMongoDBのリソースを解放
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`バッチ処理が完了しました。成功: ${totalBatches - failedCount}/${totalBatches}バッチ、合計挿入件数: ${insertedCount}`);
  } catch (error) {
    console.error('バッチ処理全体でエラーが発生しました:', error);
    throw error;
  }
}

// 実行時のヘルプメッセージを表示する関数
function showHelp() {
  console.log(`
使い方: ts-node src/scripts/batch-update.ts [オプション]

オプション:
  --limited, -l    限定モードを有効にする（デフォルトで100件のデータを取得）
  --count, -c N    取得するデータの件数を指定する（限定モード時のみ有効）
  --help, -h       このヘルプメッセージを表示する

例:
  ts-node src/scripts/batch-update.ts               全てのデータを取得（通常処理）
  ts-node src/scripts/batch-update.ts --limited     100件のデータのみ取得（リミット処理）
  ts-node src/scripts/batch-update.ts -l -c 50      50件のデータのみ取得（リミット処理）
  `);
}

// ヘルプオプションがある場合はヘルプを表示
if (args.includes('--help') || args.includes('-h')) {
  showHelp();
} else {
  // スクリプトを実行
  batchUpdate();
} 