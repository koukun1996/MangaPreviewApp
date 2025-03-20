import { Injectable } from '@angular/core';
import { Manga, MangaDocumentModel } from '../models/manga.schema';
import { MangaDocument } from '../../src/app/models/manga.interface';

@Injectable()
export class MangaRepository {
  /**
   * 漫画を作成または更新する
   */
  async createOrUpdate(manga: Partial<MangaDocument>): Promise<MangaDocument> {
    try {
      // fanzaIdで既存のドキュメントを検索
      const existingManga = await Manga.findOne({ fanzaId: manga.fanzaId });
      
      if (existingManga) {
        // 既存のドキュメントを更新
        Object.assign(existingManga, manga);
        existingManga['updatedAt'] = new Date();
        
        // キーワードと組み合わせを生成
        existingManga.generateKeywords();
        
        const saved = await existingManga.save();
        return this.convertToMangaDocument(saved);
      } else {
        // 新しいドキュメントを作成
        const newManga = new Manga(manga);
        
        // キーワードと組み合わせを生成
        newManga.generateKeywords();
        
        const saved = await newManga.save();
        return this.convertToMangaDocument(saved);
      }
    } catch (error) {
      console.error('漫画の保存エラー:', error);
      throw error;
    }
  }

  /**
   * MongooseドキュメントをMangaDocumentに変換
   */
  private convertToMangaDocument(doc: MangaDocumentModel): MangaDocument {
    const { _id, __v, ...rest } = doc.toObject();
    return {
      ...rest,
      _id: _id.toString()
    } as MangaDocument;
  }

  /**
   * ドキュメント配列を変換
   */
  private convertToMangaDocuments(docs: MangaDocumentModel[]): MangaDocument[] {
    return docs.map(doc => this.convertToMangaDocument(doc));
  }

  /**
   * 漫画をバッチ処理で保存する
   */
  async bulkSave(mangas: Partial<MangaDocument>[]): Promise<number> {
    try {
      let savedCount = 0;
      
      for (const manga of mangas) {
        await this.createOrUpdate(manga);
        savedCount++;
      }
      
      return savedCount;
    } catch (error) {
      console.error('バッチ保存エラー:', error);
      throw error;
    }
  }

  /**
   * fanzaIdで漫画を検索
   */
  async findByFanzaId(fanzaId: string): Promise<MangaDocument | null> {
    const result = await Manga.findOne({ fanzaId });
    return result ? this.convertToMangaDocument(result) : null;
  }

  /**
   * タイトルで漫画を検索
   */
  async findByTitle(title: string): Promise<MangaDocument[]> {
    const results = await Manga.find({ title: new RegExp(title, 'i') });
    return this.convertToMangaDocuments(results);
  }

  /**
   * テキストで漫画を検索
   */
  async searchByText(text: string, limit: number = 20, skip: number = 0): Promise<MangaDocument[]> {
    const results = await Manga.find(
      { $text: { $search: text } },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit);
    
    return this.convertToMangaDocuments(results);
  }

  /**
   * タグの組み合わせで漫画を検索
   */
  async findByCombination(tags: string[], limit: number = 20, skip: number = 0): Promise<MangaDocument[]> {
    // タグをソートして組み合わせパターンを統一
    const sortedTags = tags.sort();
    
    const results = await Manga.find({
      combinations: { $in: [sortedTags] }
    })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);
    
    return this.convertToMangaDocuments(results);
  }

  /**
   * 最新の漫画を取得
   */
  async findLatest(limit: number = 20, skip: number = 0): Promise<MangaDocument[]> {
    const results = await Manga.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    return this.convertToMangaDocuments(results);
  }

  /**
   * 人気タグのリストを取得
   */
  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    const result = await Manga.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, tag: '$_id', count: 1 } }
    ]);
    
    return result;
  }

  /**
   * 漫画の総数を取得
   */
  async count(): Promise<number> {
    return await Manga.countDocuments();
  }
} 