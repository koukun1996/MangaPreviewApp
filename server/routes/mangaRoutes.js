const express = require('express');
const { fetchMangaList } = require('../services/mangaService'); // services/mangaからfetchMangaList関数をインポート

const router = express.Router();

router.get('/search', async (req, res, next) => {
  try {
    const { keyword = '' } = req.query;
    console.log(`Received request with keyword: ${keyword}`); // デバッグ用ログ
    const mangaList = await fetchMangaList(keyword); // fetchMangaList関数を呼び出し
    res.json(mangaList);
  } catch (error) {
    console.error('FANZA APIから漫画を取得中にエラーが発生しました:', error.message);
    res.status(500).json({ error: '漫画データの取得に失敗しました' });
  }
});

module.exports = {
  mangaRouter: router
};