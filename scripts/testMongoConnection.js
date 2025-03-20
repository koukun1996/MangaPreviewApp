const mongoose = require('mongoose');
const dotenv = require('dotenv');

// 環境変数の読み込み
dotenv.config();

// 接続URIの取得
const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:your_secure_password@localhost:27017/manga_preview?authSource=admin&directConnection=true';

// パスワードをマスクしたURIをログ出力
const maskedUri = MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//\$1:****@');
console.log(`MongoDB接続URI: ${maskedUri}`);

// Mongooseの警告を抑制
mongoose.set('strictQuery', true);

// データベースに接続
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB接続成功！');
    console.log('データベース一覧を取得します...');
    
    // データベース一覧を取得
    return mongoose.connection.db.admin().listDatabases();
  })
  .then(result => {
    console.log('データベース一覧:');
    result.databases.forEach(db => {
      console.log(`- ${db.name}`);
    });
    
    // 接続を閉じる
    return mongoose.disconnect();
  })
  .then(() => {
    console.log('MongoDB接続を閉じました');
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB接続エラー:', err);
    process.exit(1);
  }); 