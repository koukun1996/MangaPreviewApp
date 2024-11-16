const express = require('express');
const { fetchMangaList } = require('../services/mangaService'); // services/mangaからfetchMangaList関数をインポート
const { query, validationResult } = require('express-validator'); // express-validatorから必要な関数をインポート

const router = express.Router();

router.get('/search', [
  // バリデーションルールを変更
  query('keyword').optional() // keywordを任意に
], async (req, res, next) => {
  // バリデーション結果をチェック
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // エラーがある場合、400ステータスコードとエラーメッセージを返す
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { keyword = '' } = req.query; // keywordが空の場合には空文字列を使用
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
