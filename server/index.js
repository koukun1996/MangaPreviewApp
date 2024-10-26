const express = require('express');
const cors = require('cors');
const { mangaRouter } = require('./routes/mangaRoutes'); // 新しいファイル名を使用
require('dotenv').config(); // 環境変数を読み込む

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/manga', mangaRouter); // ここでエンドポイントを設定

const PORT = process.env.PORT || 3000; // 環境変数を使用してポートを設定
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});