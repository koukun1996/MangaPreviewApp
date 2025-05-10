import mongoose, { Document, Schema } from 'mongoose';
import { MangaDocument } from '../../src/app/models/manga.interface';

// mongoose.Documentを継承したMangaModelドキュメント型
export interface MangaDocumentModel extends Document, Omit<MangaDocument, '_id'> {
  isNew: boolean;
  generateKeywords: () => void;
  generateCombinations: (tags: string[]) => string[][];
}

const MangaSchema = new Schema({
  fanzaId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  price: { type: Number, required: true },
  thumbnailUrl: { type: String, required: true },
  tags: { type: [String], default: [] },
  description: { type: String, default: '' },
  affiliateUrl: { type: String, default: '' },
  tachiyomiUrl: { type: String, default: '' },
  searchKeywords: { type: [String], default: [] },
  combinations: { type: [[String]], default: [] },
  lastUpdated: { type: Date }
}, {
  timestamps: true // createdAtとupdatedAtを自動管理
});

// テキスト検索のインデックス
MangaSchema.index({ title: 'text', author: 'text', tags: 'text' });

// キーワード生成メソッド
MangaSchema.methods['generateKeywords'] = function() {
  const manga = this;
  const keywords = [
    manga['title'],
    manga['author'],
    ...manga['tags']
  ].filter(Boolean);
  
  // 単語の組み合わせを生成
  const combinationKeywords = manga['generateCombinations'](manga['tags'] || []);
  
  // 検索キーワードを設定
  manga['searchKeywords'] = [...new Set([...keywords, ...combinationKeywords.flat()])];
  
  // 組み合わせ配列を保存
  manga['combinations'] = combinationKeywords;
  
  // 最終更新日時を更新
  manga['lastUpdated'] = new Date();
};

// タグの組み合わせを生成
MangaSchema.methods['generateCombinations'] = function(tags: string[]) {
  if (!tags || tags.length === 0) return [[]];
  
  // タグをソート
  const sortedTags = [...tags].sort();
  const combinations: string[][] = [];
  
  // 2つ以上のタグの組み合わせのみを生成
  for (let i = 2; i <= sortedTags.length; i++) {
    generateCombos(sortedTags, i, 0, [], combinations);
  }
  
  return combinations;
};

// 再帰的に組み合わせを生成する関数
function generateCombos(
  arr: string[],
  size: number,
  start: number,
  current: string[],
  result: string[][]
) {
  if (current.length === size) {
    result.push([...current]);
    return;
  }
  
  for (let i = start; i < arr.length; i++) {
    current.push(arr[i]);
    generateCombos(arr, size, i + 1, current, result);
    current.pop();
  }
}

// モデルをエクスポート
export const Manga = mongoose.model<MangaDocumentModel>('Manga', MangaSchema); 