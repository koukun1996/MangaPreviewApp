require('dotenv').config();
const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { mangaRouter } = require('./routes/mangaRoutes');

const app = express();

// 'X-Powered-By'ヘッダーを無効化
app.disable('x-powered-by');

// trust first proxy
app.set('trust proxy', 1);

// レートリミッターの設定
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分間
  max: 100, // 各IPからの最大リクエスト数
});
app.use(limiter);

// リクエストのパース
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
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
  });
}

// アプリケーションをエクスポート
module.exports = app;
