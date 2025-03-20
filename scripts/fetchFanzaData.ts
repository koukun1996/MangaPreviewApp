import axios from 'axios';
import * as dotenv from 'dotenv';
import { DatabaseService } from '../server/services/database.service';
import MangaModel from '../server/models/manga.model';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

// 環境変数の読み込み
dotenv.config();

// APIエンドポイントとパラメータの設定
const API_BASE_URL = 'https://api.dmm.com/affiliate/v3/ItemList';
const API_FLOORLIST_URL = 'https://api.dmm.com/affiliate/v3/FloorList';
const API_ID = process.env['FANZA_API_ID'] || '';
const AFFILIATE_ID = process.env['FANZA_AFFILIATE_ID'] || '';
// MongoDB URIを直接指定
const MONGO_URI = 'mongodb://admin:your_secure_password@localhost:27017/manga_preview?authSource=admin&directConnection=true';

// Mongooseの警告を抑制
mongoose.set('strictQuery', true);

// ログディレクトリの設定
const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 現在の日時を取得してログファイル名を生成
const now = new Date();
const logFileName = `fanza_fetch_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}.log`;
const logFilePath = path.join(LOG_DIR, logFileName);

// ログ出力関数
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(logFilePath, logMessage);
}

/**
 * FANZAのフロア一覧を取得する関数
 */
async function fetchFloorList(): Promise<any[]> {
  try {
    const params = {
      api_id: API_ID,
      affiliate_id: AFFILIATE_ID,
      site: 'FANZA',
      service: 'ebook',
      output: 'json'
    };

    log('フロア一覧を取得します...');
    const response = await axios.get(API_FLOORLIST_URL, { params });
    
    if (response.data && response.data.result && response.data.result.site) {
      // FANZAブックスの情報を探す
      const fanzaSite = response.data.result.site.find((site: any) => site.name === 'FANZA');
      if (fanzaSite) {
        const ebookService = fanzaSite.service.find((service: any) => service.code === 'ebook');
        if (ebookService && ebookService.floor) {
          log(`ブックスフロア情報を取得: ${ebookService.floor.length}件のフロア`);
          return ebookService.floor;
        }
      }
      log('FANZAブックスのフロア情報が見つかりませんでした');
      // フロア情報が見つからない場合、デフォルトでコミックフロアを返す
      return [{ id: '82', name: 'コミック', code: 'comic' }];
    } else {
      log('API応答からフロア情報を取得できませんでした');
      return [{ id: '82', name: 'コミック', code: 'comic' }];
    }
  } catch (error: any) {
    log(`フロア一覧取得エラー: ${error.message}`);
    if (error.response) {
      log(`エラーレスポンス: ${JSON.stringify(error.response.data)}`);
    }
    // エラーが発生した場合、デフォルトでコミックフロアを返す
    return [{ id: '82', name: 'コミック', code: 'comic' }];
  }
}

/**
 * FANZA APIからデータを取得する関数
 */
async function fetchFanzaData(floor: string, offset: number = 1, hits: number = 100): Promise<any> {
  try {
    const params = {
      api_id: API_ID,
      affiliate_id: AFFILIATE_ID,
      site: 'FANZA',
      service: 'ebook',
      floor: floor,
      hits: hits,
      offset: offset,
      output: 'json'
    };

    log(`APIリクエスト実行: floor=${floor}, offset=${offset}, hits=${hits}`);
    log(`リクエストパラメータ: ${JSON.stringify(params)}`);
    
    const response = await axios.get(API_BASE_URL, { params });
    
    if (response.data && response.data.result) {
      if (response.data.result.status) {
        log(`APIステータス: ${response.data.result.status}`);
      }
      
      if (response.data.result.items) {
        log(`APIレスポンス受信: ${response.data.result.items.length}件のデータ`);
        return response.data.result.items;
      } else {
        log(`APIレスポンス異常: items配列がありません。レスポンス: ${JSON.stringify(response.data)}`);
        return [];
      }
    } else {
      log(`APIからのレスポンスが不正な形式です。レスポンス: ${JSON.stringify(response.data)}`);
      return [];
    }
  } catch (error: any) {
    log(`APIリクエストエラー: ${error.message}`);
    if (error.response) {
      log(`エラーレスポンス: ${JSON.stringify(error.response.data)}`);
    }
    return [];
  }
}

/**
 * 取得したデータをMongoDB形式に変換する関数
 */
function transformData(items: any[]): any[] {
  return items.map(item => {
    // タグの抽出
    const tags = [];
    if (item.genre && Array.isArray(item.genre)) {
      tags.push(...item.genre.map((g: any) => g.name));
    }
    if (item.author) {
      tags.push(item.author);
    }
    if (item.maker && item.maker.name) {
      tags.push(item.maker.name);
    }
    if (item.publisher && item.publisher.name) {
      tags.push(item.publisher.name);
    }
    
    // サンプル画像URLの抽出
    const sampleImageUrls = [];
    if (item.sampleImageURL) {
      if (item.sampleImageURL.sample_s) {
        sampleImageUrls.push(item.sampleImageURL.sample_s.image);
      }
      if (item.sampleImageURL.sample_l) {
        sampleImageUrls.push(item.sampleImageURL.sample_l.image);
      }
      if (item.sampleImageURL.sample_2x) {
        sampleImageUrls.push(item.sampleImageURL.sample_2x.image);
      }
    }
    
    // 検索用キーワードの生成
    const searchKeywords = [
      item.title,
      item.author,
      item.maker?.name,
      item.publisher?.name,
      ...(item.genre ? item.genre.map((g: any) => g.name) : [])
    ].filter(Boolean).map(str => str.toLowerCase());
    
    // 価格の処理
    let price = 0;
    if (item.price) {
      price = parseInt(item.price, 10);
      if (isNaN(price)) {
        price = 0;
      }
    }
    
    return {
      fanzaId: item.content_id,
      title: item.title || '無題',
      author: item.author || item.maker?.name || '不明',
      price: price,
      thumbnailUrl: item.imageURL?.large || '',
      tags: tags,
      description: item.description || '',
      affiliateUrl: item.affiliateURL || '',
      tachiyomiUrl: item.tachiyomi?.URL || '',
      sampleImageUrls: sampleImageUrls,
      searchKeywords: searchKeywords,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });
}

/**
 * インデックスの最適化を行う関数
 */
async function optimizeIndexes() {
  log('インデックスの最適化を実行中...');
  try {
    // データベース接続が有効か確認
    if (!mongoose.connection || !mongoose.connection.db) {
      log('データベース接続が無効です');
      return;
    }
    
    const db = mongoose.connection.db;
    const collection = db.collection('mangas');
    
    // 既存インデックスの確認
    const indexes = await collection.indexes();
    log(`現在のインデックス数: ${indexes.length}`);
    
    // 検索用インデックスが存在しない場合は作成
    const hasSearchKeywordsIndex = indexes.some(idx => 
      idx.name === 'searchKeywords_1' || 
      (idx.key && idx.key['searchKeywords'] === 1)
    );
    if (!hasSearchKeywordsIndex) {
      await collection.createIndex({ searchKeywords: 1 }, { 
        background: true,
        name: 'searchKeywords_1' 
      });
      log('searchKeywordsインデックスを作成しました');
    }
    
    // タグ用インデックスが存在しない場合は作成
    const hasTagsIndex = indexes.some(idx => 
      idx.name === 'tags_1' || 
      (idx.key && idx.key['tags'] === 1)
    );
    if (!hasTagsIndex) {
      await collection.createIndex({ tags: 1 }, { 
        background: true,
        name: 'tags_1' 
      });
      log('tagsインデックスを作成しました');
    }
    
    // fanzaId用のユニークインデックスが存在しない場合は作成
    const hasFanzaIdIndex = indexes.some(idx => 
      idx.name === 'fanzaId_1' || 
      idx.name === 'fanzaId_1_unique' ||
      (idx.key && idx.key['fanzaId'] === 1)
    );
    if (!hasFanzaIdIndex) {
      await collection.createIndex({ fanzaId: 1 }, { 
        background: true,
        unique: true,
        name: 'fanzaId_1' 
      });
      log('fanzaIdユニークインデックスを作成しました');
    }
  } catch (error: any) {
    log(`インデックス最適化エラー: ${error.message}`);
  }
}

/**
 * メイン処理: FANZA APIからデータを取得してMongoDBに保存
 */
async function main() {
  try {
    // 処理開始ログ
    log('==== FANZAデータ取得バッチ処理開始 ====');
    
    // APIキーのチェック
    if (!API_ID || !AFFILIATE_ID) {
      log('API_IDまたはAFFILIATE_IDが設定されていません。.envファイルを確認してください。');
      process.exit(1);
    }
    
    // 使用するMONGO_URIをログに出力（パスワードはマスク）
    const maskedUri = MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
    log(`MongoDB接続URI: ${maskedUri}`);
    
    try {
      // データベースに接続
      await DatabaseService.getInstance().connect(MONGO_URI);
      log('MongoDB接続成功');
    } catch (dbError: any) {
      log(`MongoDB接続エラー: ${dbError.message}`);
      log(dbError.stack);
      process.exit(1);
    }
    
    // 処理統計情報の初期化
    let totalItems = 0;
    let newItems = 0;
    let updatedItems = 0;
    let errorItems = 0;
    
    // フロア情報の取得
    const floors = await fetchFloorList();
    
    // 各フロアのデータを取得
    for (const floor of floors) {
      log(`フロア[${floor.name}]のデータ取得を開始します...`);
      
      // 無限ループ防止用の変数
      let lastTotalItems = 0;
      let noNewItemsCount = 0;
      const MAX_NO_NEW_ITEMS = 3; // 3回連続で新規データが取得できない場合は終了
      
      // offsetを1から開始し、hits=100で取得
      let offset = 1;
      const hits = 100;
      
      while (true) {
        // APIからデータを取得
        const items = await fetchFanzaData(floor.code, offset, hits);
        
        // データが取得できない場合は次のフロアに進む
        if (items.length === 0) {
          log(`フロア[${floor.name}] offset=${offset}でデータが取得できませんでした。次のフロアに進みます。`);
          break;
        }
        
        // データの変換
        const transformedItems = transformData(items);
        totalItems += transformedItems.length;
        
        // データをMongoDBに保存
        let newItemsInThisBatch = 0;
        for (const item of transformedItems) {
          try {
            // 既存のデータをチェック
            const existingManga = await MangaModel.findOne({ fanzaId: item.fanzaId });
            
            if (existingManga) {
              // 更新が必要かチェック
              const lastUpdated = new Date(existingManga.updatedAt);
              const now = new Date();
              const daysDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 3600 * 24);
              
              // 常に更新を行う（データの整合性を保つため）
              await MangaModel.updateOne(
                { fanzaId: item.fanzaId },
                { $set: { ...item, updatedAt: new Date() } }
              );
              updatedItems++;
              log(`漫画データを更新しました: ${item.title}`);
            } else {
              // 新規データの挿入
              await MangaModel.create(item);
              newItems++;
              newItemsInThisBatch++;
              log(`新しい漫画データを追加しました: ${item.title}`);
            }
          } catch (error: any) {
            log(`データ保存エラー: ${error.message}`);
            errorItems++;
          }
        }
        
        // 無限ループ防止のチェック
        if (newItemsInThisBatch === 0) {
          noNewItemsCount++;
          if (noNewItemsCount >= MAX_NO_NEW_ITEMS) {
            log(`フロア[${floor.name}]で${MAX_NO_NEW_ITEMS}回連続で新規データが取得できませんでした。次のフロアに進みます。`);
            break;
          }
        } else {
          noNewItemsCount = 0;
        }
        
        // 取得したデータ数がhits未満の場合は終了
        if (items.length < hits) {
          log(`フロア[${floor.name}]の全データを取得しました。次のフロアに進みます。`);
          break;
        }
        
        // offsetを更新（1から始まるため、hitsを加算）
        offset += hits;
        
        // API負荷軽減のための待機
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // インデックスの最適化
    await optimizeIndexes();
    
    // 処理結果のサマリー
    log('==== バッチ処理完了 ====');
    log(`処理アイテム総数: ${totalItems}`);
    log(`新規追加: ${newItems}`);
    log(`更新: ${updatedItems}`);
    log(`エラー: ${errorItems}`);
    
    // データベース接続を切断
    await DatabaseService.getInstance().disconnect();
    log('MongoDB切断成功');
    
    // 正常終了
    process.exit(0);
  } catch (error: any) {
    log(`バッチ処理でエラーが発生しました: ${error.message}`);
    log(error.stack);
    
    // エラー終了
    process.exit(1);
  }
}

// メイン処理を実行
main(); 