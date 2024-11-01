const express = require('express');
const cors = require('cors');
const path = require('path'); // pathモジュールを使用
const { mangaRouter } = require('./routes/mangaRoutes'); // 新しいファイル名を使用
require('dotenv').config(); // 環境変数を読み込む

const app = express();

// CORSとJSONリクエストの設定
app.use(cors());
app.use(express.json());

// フロントエンドの静的ファイルを配信する設定
app.use(express.static(path.join(__dirname, 'public/browser'))); // 正しいパスを設定

// APIエンドポイントの設定
app.use('/api/manga', mangaRouter); // APIエンドポイントを設定

// すべてのルートに対するリクエストをindex.htmlにルーティング（API以外）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/browser', 'index.html')); // 正しいパスを設定
});

// サーバーのポート設定と起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

