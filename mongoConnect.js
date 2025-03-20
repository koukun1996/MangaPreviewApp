// mongoConnect.js
require('dotenv').config(); // dotenvを読み込む

const mongoose = require('mongoose');

// Mangaスキーマを定義
const mangaSchema = new mongoose.Schema({
  title: String,
  genre: String,
  // 他のフィールド
});

const Manga = mongoose.model('Manga', mangaSchema);

// 環境変数からMONGO_URIを取得
const uri = process.env.MONGO_URI;

console.log('接続先：', uri);

mongoose.connect(uri, {})
    .then(async () => {
        console.log('MongoDBに接続しました');
        
        // データベースの一覧を取得
        const dbListResult = await mongoose.connection.db.admin().listDatabases();
        console.log('利用可能なデータベース：');
        dbListResult.databases.forEach(db => {
            console.log(` - ${db.name}`);
        });

        // manga_previewデータベースを使用
        await mongoose.connection.useDb('manga_preview');
        
        // ジャンル一覧を取得
        const genres = await Manga.distinct('genre');
        console.log('利用可能なジャンル：', genres);

        // 接続を閉じる
        mongoose.connection.close();
    })
    .catch(err => console.error('MongoDB接続エラー:', err)); 