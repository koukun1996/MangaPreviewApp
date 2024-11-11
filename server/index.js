require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const { mangaRouter } = require('./routes/mangaRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// 静的ファイルのパス設定
const staticPath = path.join(__dirname, 'public/browser');
app.use(express.static(staticPath));

// APIエンドポイントの設定
app.use('/api/manga', mangaRouter);

// すべてのルートに対するリクエストを index.html にルーティング
if (process.env.NODE_ENV === 'test') {
  app.get('*', (req, res) => {
    res.status(200).send('Test response');
  });
} else {
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// サーバーの起動を条件付きにする
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

// アプリケーションをエクスポート
module.exports = app;
