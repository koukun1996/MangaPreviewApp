import { DatabaseService } from '../server/services/database.service';
import MangaModel from '../server/models/manga.model';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

// 環境変数を読み込む
dotenv.config();

// Mongooseの警告を抑制
mongoose.set('strictQuery', true);

const MONGO_URI = process.env['MONGO_URI'] || 'mongodb://admin:your_secure_password@localhost:27017/manga_preview?authSource=admin&directConnection=true';

/**
 * ダミーの漫画データを生成
 */
function createDummyManga(index: number) {
  return {
    fanzaId: `dummy-${index}`,
    title: `テスト漫画 ${index}`,
    author: `テスト作者 ${index}`,
    price: 100 + index * 100,
    thumbnailUrl: `https://picsum.photos/200/300?random=${index}`,
    description: `テスト漫画${index}の説明文です。`,
    tags: [`タグ${index}`, 'テスト', `カテゴリー${index % 5}`],
    affiliateUrl: `https://example.com/manga/${index}`,
    tachiyomiUrl: `https://example.com/tachiyomi/${index}`,
    sampleImageUrls: [
      `https://picsum.photos/200/300?random=${index}`,
      `https://picsum.photos/200/300?random=${index + 100}`
    ],
  };
}

/**
 * 既存のインデックスを削除し、新しいインデックスを作成
 */
async function manageIndexes() {
  try {
    // MongoDBネイティブドライバを使用してコレクションにアクセス
    const db = mongoose.connection.db;
    if (!db) {
      console.warn('データベース接続が確立されていません');
      return;
    }
    
    const collection = db.collection('mangas');
    
    // すべての既存インデックスを削除（_idは除外）
    const indexes = await collection.indexes();
    for (const index of indexes) {
      const indexName = index.name;
      if (indexName && indexName !== '_id_') {
        try {
          await collection.dropIndex(indexName);
          console.log(`インデックス ${indexName} を削除しました`);
        } catch (error) {
          console.error(`インデックス ${indexName} の削除に失敗: ${error}`);
        }
      }
    }
    
    // 必要なインデックスを作成
    // fanzaIdをユニークに設定
    await collection.createIndex({ fanzaId: 1 }, { 
      unique: true,
      name: 'fanzaId_1_unique',
      background: true 
    });
    console.log('fanzaIdのユニークインデックスを作成しました');
    
    // 検索用インデックスを作成
    await collection.createIndex({ searchKeywords: 1 }, { 
      name: 'searchKeywords_1',
      background: true,
      sparse: true 
    });
    console.log('searchKeywordsインデックスを作成しました');
    
    await collection.createIndex({ combinations: 1 }, { 
      name: 'combinations_1',
      background: true,
      sparse: true 
    });
    console.log('combinationsインデックスを作成しました');
    
    console.log('すべてのインデックスを再作成しました');
  } catch (error) {
    console.error('インデックス管理エラー:', error);
  }
}

/**
 * データベースにダミーデータを生成して保存
 */
async function generateAndSaveDummyData() {
  try {
    // データベースに接続
    await DatabaseService.getInstance().connect(MONGO_URI);
    
    // データベースを取得（万が一の場合に備えて）
    if (!mongoose.connection.db) {
      throw new Error('データベース接続が確立されていません');
    }

    // ネイティブコレクションを使用してデータを削除
    const collection = mongoose.connection.db.collection('mangas');
    await collection.deleteMany({});
    console.log('既存のデータを削除しました');

    // ダミーデータを生成
    const dummyData = Array.from({ length: 20 }, (_, i) => createDummyManga(i + 1));
    
    // ネイティブコレクションを使用してデータを挿入
    await collection.insertMany(dummyData);
    console.log('ダミーデータを保存しました');

    // インデックスを管理
    await manageIndexes();

    // 接続を切断
    await DatabaseService.getInstance().disconnect();
    console.log('MongoDB切断成功');
    console.log('完了');
    
    // 正常終了
    setTimeout(() => process.exit(0), 500); // 少し長めに待機
  } catch (error) {
    console.error('エラーが発生しました:', error);
    // エラー終了
    setTimeout(() => process.exit(1), 500); // 少し長めに待機
  }
}

// スクリプトを実行
generateAndSaveDummyData(); 