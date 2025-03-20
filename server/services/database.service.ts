import * as mongoose from 'mongoose';

/**
 * データベース接続サービス
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private _isConnected = false;
  private _mongoose: typeof mongoose | null = null;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * データベースに接続
   * @param uri MongoDB接続URI
   */
  public async connect(uri: string): Promise<typeof mongoose> {
    if (this._isConnected && this._mongoose) {
      return this._mongoose;
    }

    try {
      // Mongoose警告を抑制
      mongoose.set('strictQuery', true);
      
      // 接続オプションを設定して再インデックス問題を防止
      const connection = await mongoose.connect(uri, {
        autoIndex: false,  // 自動インデックス作成を無効化
        autoCreate: false, // 自動コレクション作成を無効化
      });
      
      this._isConnected = true;
      this._mongoose = mongoose;
      console.log('MongoDB接続成功');
      return connection;
    } catch (error) {
      console.error('MongoDB接続エラー:', error);
      this._isConnected = false;
      throw error;
    }
  }

  /**
   * データベース接続を切断
   */
  public async disconnect(): Promise<void> {
    if (!this._isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this._isConnected = false;
      this._mongoose = null;
    } catch (error) {
      console.error('MongoDB切断エラー:', error);
      throw error;
    }
  }

  /**
   * 接続状態を取得
   */
  public get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * 接続インスタンスを取得
   */
  public get connection(): mongoose.Connection | null {
    return this._mongoose ? this._mongoose.connection : null;
  }
} 