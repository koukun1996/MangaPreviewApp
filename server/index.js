require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { mangaRouter } = require('./routes/mangaRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// 静的ファイルのパス設定
const staticPath = path.join(__dirname, 'public/browser');
app.use(express.static(staticPath));

// APIエンドポイントの設定
app.use('/api/manga', mangaRouter);

// すべてのルートに対するリクエストをindex.htmlにルーティング
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
