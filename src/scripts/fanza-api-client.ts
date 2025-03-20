import axios from 'axios';
import { Manga, ApiResponse, ApiResponseItem } from '../app/models/manga.interface';
import * as dotenv from 'dotenv';

// .envファイルを読み込む
dotenv.config();

export class FanzaApiClient {
  private apiUrl: string;
  private apiId: string;
  private affiliateId: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
    this.apiId = process.env['FANZA_API_ID'] || 'mnXeLfwzmfgrQRARukuJ';
    this.affiliateId = process.env['FANZA_AFFILIATE_ID'] || 'himitsuNight-990';
  }

  async getMangaById(fanzaId: string): Promise<Manga> {
    const response = await axios.get<Manga>(`${this.apiUrl}/api/manga/${fanzaId}`);
    return response.data;
  }

  /**
   * 限定数のマンガデータを取得するメソッド
   * @param limit 取得するデータの件数（デフォルト: 100件）
   * @returns 取得したマンガデータの配列
   */
  async getLimitedManga(limit: number = 100): Promise<Manga[]> {
    const fanzaApiUrl = 'https://api.dmm.com/affiliate/v3/ItemList';
    const HITS_PER_PAGE = Math.min(limit, 100); // 1回のAPIリクエストで最大100件
    let currentOffset = 1; // 開始位置
    const allMangaList: Manga[] = []; // 全データを格納する配列

    console.log(`FANZA APIから最大${limit}件のデータを取得します...`);

    try {
      // 1回だけリクエストを行う（最大100件）
      const params = {
        api_id: this.apiId,
        affiliate_id: this.affiliateId,
        site: 'FANZA',
        service: 'ebook',
        floor: 'comic',
        hits: HITS_PER_PAGE,
        offset: currentOffset,
        sort: 'rank',
        output: 'json'
      };

      console.log(`FANZA APIに接続します... (offset: ${currentOffset})`);
      const response = await axios.get(fanzaApiUrl, { params });
      console.log(`FANZA APIからレスポンスを受信しました (offset: ${currentOffset})`);

      if (!response.data || !response.data.result || !response.data.result.items || response.data.result.items.length === 0) {
        console.log('データはありません。データ取得を終了します。');
        return [];
      }

      const items = response.data.result.items;
      console.log(`${items.length}件のマンガデータを取得しました (offset: ${currentOffset})`);

      // 最初の1件のレスポンス詳細をログ出力（デバッグ用）
      if (items.length > 0) {
        console.log('APIレスポンスの最初の1件（詳細）:', JSON.stringify(items[0], null, 2));
      }

      // APIレスポンスからMangaオブジェクトに変換
      const mangaList: Manga[] = items.map((item: any) => this.convertToManga(item));

      // 結果を結合（指定された上限までのみ追加）
      const toAdd = Math.min(mangaList.length, limit);
      allMangaList.push(...mangaList.slice(0, toAdd));

      console.log(`合計${allMangaList.length}件のマンガデータを取得しました`);
      return allMangaList;
    } catch (error) {
      console.error('FANZA APIからデータの取得に失敗しました:', error);
      
      // エラーレスポンスの詳細を取得
      if (axios.isAxiosError(error) && error.response) {
        console.error('エラーレスポンス:', error.response.data);
      }
      
      // エラーが発生した場合は空配列を返す
      return [];
    }
  }

  /**
   * すべてのマンガデータを取得するメソッド
   * @returns 取得したマンガデータの配列
   */
  async getAllManga(): Promise<Manga[]> {
    const fanzaApiUrl = 'https://api.dmm.com/affiliate/v3/ItemList';
    const HITS_PER_PAGE = 100; // 1ページあたりの取得件数
    let currentOffset = 1; // 開始位置
    let hasMoreData = true; // まだデータがあるかどうか
    const allMangaList: Manga[] = []; // 全データを格納する配列

    console.log('FANZA APIからすべてのデータの取得を開始します...');

    // データが取得できなくなるまで繰り返し
    while (hasMoreData) {
      try {
        const params = {
          api_id: this.apiId,
          affiliate_id: this.affiliateId,
          site: 'FANZA',
          service: 'ebook',
          floor: 'comic',
          hits: HITS_PER_PAGE,
          offset: currentOffset,
          sort: 'rank',
          output: 'json'
        };

        console.log(`FANZA APIに接続します... (offset: ${currentOffset})`);
        const response = await axios.get(fanzaApiUrl, { params });
        console.log(`FANZA APIからレスポンスを受信しました (offset: ${currentOffset})`);

        if (!response.data || !response.data.result || !response.data.result.items || response.data.result.items.length === 0) {
          console.log('これ以上データはありません。データ取得を終了します。');
          hasMoreData = false;
          break;
        }

        const items = response.data.result.items;
        console.log(`${items.length}件のマンガデータを取得しました (offset: ${currentOffset})`);

        // 最初のリクエストの最初の1件のレスポンス詳細をログ出力（デバッグ用）
        if (currentOffset === 1 && items.length > 0) {
          console.log('APIレスポンスの最初の1件（詳細）:', JSON.stringify(items[0], null, 2));
        }

        // APIレスポンスからMangaオブジェクトに変換
        const mangaList: Manga[] = items.map((item: any) => this.convertToManga(item));

        // 結果を結合
        allMangaList.push(...mangaList);

        // 取得件数が指定した件数(HITS_PER_PAGE)より少ない場合は終了
        if (items.length < HITS_PER_PAGE) {
          console.log(`取得件数(${items.length})が指定した件数(${HITS_PER_PAGE})より少ないため、データ取得を終了します。`);
          hasMoreData = false;
        } else {
          // 次のページへ
          currentOffset += HITS_PER_PAGE;
        }

        // APIリクエストの間隔を空ける（レート制限対策）
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`FANZA APIからのデータ取得中にエラーが発生しました (offset: ${currentOffset}):`, error);
        
        // エラーレスポンスの詳細を取得
        if (axios.isAxiosError(error) && error.response) {
          console.error('エラーレスポンス:', error.response.data);
        }
        
        // エラーが発生しても、すでに取得したデータがあれば処理を継続
        console.log(`エラーが発生しましたが、すでに取得した${allMangaList.length}件のデータを使用します。`);
        hasMoreData = false; // 次のデータ取得を中止
        break;
      }
    }

    console.log(`合計${allMangaList.length}件のマンガデータを取得しました`);
    return allMangaList;
  }

  /**
   * APIレスポンスのアイテムをMangaオブジェクトに変換するヘルパーメソッド
   * @param item APIレスポンスのアイテム
   * @returns 変換されたMangaオブジェクト
   */
  private convertToManga(item: any): Manga {
    // ジャンル情報は item.iteminfo.genre に格納されています
    const genreArray = item.iteminfo?.genre || [];
    console.log('ジャンル情報:', JSON.stringify(genreArray, null, 2));
    
    // ジャンル情報の変換（APIからのレスポンス形式に合わせて調整）
    const genres = Array.isArray(genreArray) ? genreArray.map((genre: any) => ({
      name: genre.name || '',
      id: genre.id || ''
    })) : [];
    
    // ジャンル名の配列を作成
    const tags = genres.map(genre => genre.name);
    
    return {
      fanzaId: item.content_id,
      title: item.title,
      author: item.iteminfo?.author?.[0]?.name || '不明',
      price: parseInt(item.prices?.price || '0'),
      thumbnailUrl: item.imageURL?.large || '', // large画像を使用
      tags: tags,
      genres: genres, // 変換したジャンル情報を使用
      description: item.summary || '',
      affiliateUrl: item.affiliateURL || '',
      tachiyomiUrl: item.tachiyomi?.URL || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      sampleImageUrls: item.sampleImageURL?.sample_s?.image || []
    };
  }
} 