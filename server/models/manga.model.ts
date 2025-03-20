import { Schema, model, Document, models } from 'mongoose';

export interface IManga extends Document {
  fanzaId: string;
  title: string;
  author: string;
  price: number;
  thumbnailUrl: string;
  description: string;
  tags: string[];
  affiliateUrl: string;
  tachiyomiUrl: string;
  sampleImageUrls: string[];
  searchKeywords?: string[];
  combinations?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const schemaDefinition = {
  fanzaId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  price: { type: Number, required: true },
  thumbnailUrl: { type: String, required: true },
  description: { type: String, default: '' },
  tags: [{ type: String }],
  affiliateUrl: { type: String, default: '' },
  tachiyomiUrl: { type: String, default: '' },
  sampleImageUrls: [{ type: String }],
  searchKeywords: [{ type: String }],
  combinations: [{ type: String }]
};

const schemaOptions = {
  timestamps: true,
  collection: 'mangas',
  autoIndex: false // 自動インデックス作成を無効化
};

const MangaSchema = new Schema(schemaDefinition, schemaOptions);

// インデックスを明示的に定義（重複を避けるため、スキーマ定義からインデックスを削除）
MangaSchema.index({ searchKeywords: 1 }, { name: 'searchKeywords_1' });
MangaSchema.index({ combinations: 1 }, { name: 'combinations_1' });
MangaSchema.index({ tags: 1 }, { name: 'tags_1' });

// モデルの重複定義を防止
export const MangaModel = models['Manga'] || model<IManga>('Manga', MangaSchema);

export default MangaModel; 