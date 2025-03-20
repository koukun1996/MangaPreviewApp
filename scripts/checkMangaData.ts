import * as dotenv from 'dotenv';
import { DatabaseService } from '../server/services/database.service';
import MangaModel, { IManga } from '../server/models/manga.model';
import mongoose from 'mongoose';

// 環境変数の読み込み
dotenv.config();

// MongoDB URIを直接指定
const MONGO_URI = 'mongodb://admin:your_secure_password@localhost:27017/manga_preview?authSource=admin&directConnection=true';

async function main() {
  try {
    console.log('==== 漫画データ確認開始 ====');
    console.log('MongoDB接続URI:', MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
    
    // データベースに接続
    await DatabaseService.getInstance().connect(MONGO_URI);
    console.log('MongoDB接続成功');
    
    // コレクションの存在確認
    if (!mongoose.connection.db) {
      throw new Error('データベース接続が確立されていません');
    }
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n利用可能なコレクション:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // 全データ数を取得
    const totalCount = await MangaModel.countDocuments();
    console.log(`\n全データ数: ${totalCount}件`);
    
    if (totalCount === 0) {
      console.log('警告: データが存在しません');
      return;
    }
    
    // 最新の10件を表示
    console.log('\n最新の10件のデータ:');
    const latestManga = await MangaModel.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean<IManga[]>(); // パフォーマンス向上のためlean()を使用
    
    if (latestManga.length === 0) {
      console.log('警告: 最新データの取得に失敗しました');
      return;
    }
    
    latestManga.forEach((manga, index) => {
      console.log(`\n${index + 1}. ${manga['title']}`);
      console.log(`   - 作者: ${manga['author']}`);
      console.log(`   - 価格: ${manga['price']}円`);
      console.log(`   - タグ: ${manga['tags'].join(', ')}`);
      console.log(`   - 作成日: ${manga['createdAt']}`);
      console.log(`   - 更新日: ${manga['updatedAt']}`);
    });
    
    // タグの集計
    console.log('\nタグの集計:');
    const allManga = await MangaModel.find().lean<IManga[]>();
    const tagCount: { [key: string]: number } = {};
    
    allManga.forEach(manga => {
      manga['tags'].forEach((tag: string) => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });
    
    // タグを出現回数でソート
    const sortedTags = Object.entries(tagCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20); // 上位20件を表示
    
    sortedTags.forEach(([tag, count], index) => {
      console.log(`${index + 1}. ${tag}: ${count}件`);
    });
    
    // データベース接続を切断
    await DatabaseService.getInstance().disconnect();
    console.log('\nMongoDB切断成功');
    
  } catch (error: any) {
    console.error('エラーが発生しました:', error);
    console.error('エラーの詳細:', error.stack);
    process.exit(1);
  }
}

// メイン処理を実行
main(); 