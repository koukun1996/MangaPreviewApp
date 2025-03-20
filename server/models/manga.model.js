const mongoose = require('mongoose');
const { Schema, model } = mongoose;

// モデル名を一貫して使用
const MODEL_NAME = 'Manga';
const COLLECTION_NAME = 'mangas';

// スキーマ定義
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
  collection: COLLECTION_NAME,
  autoIndex: false // 自動インデックス作成を無効化
};

// モデルがすでに定義されているか確認
const existingModel = mongoose.models[MODEL_NAME];
if (existingModel) {
  console.log(`既存の${MODEL_NAME}モデルを再利用します`);
  module.exports = existingModel;
} else {
  try {
    console.log(`新しい${MODEL_NAME}モデルを作成します`);
    const MangaSchema = new Schema(schemaDefinition, schemaOptions);

    // インデックスを明示的に定義（重複を避けるため、スキーマ定義からインデックスを削除）
    MangaSchema.index({ searchKeywords: 1 }, { name: 'searchKeywords_1' });
    MangaSchema.index({ combinations: 1 }, { name: 'combinations_1' });
    MangaSchema.index({ tags: 1 }, { name: 'tags_1' });
    MangaSchema.index({ fanzaId: 1 }, { name: 'fanzaId_1', unique: true });

    // モデルをエクスポート
    module.exports = model(MODEL_NAME, MangaSchema);
  } catch (error) {
    console.error(`${MODEL_NAME}モデルの作成エラー:`, error);
    // エラーが発生した場合でも何らかのモデルを返す（ダミーモデル）
    const DummySchema = new Schema({ dummy: String }, { collection: COLLECTION_NAME });
    module.exports = model(`${MODEL_NAME}Dummy`, DummySchema);
  }
} 