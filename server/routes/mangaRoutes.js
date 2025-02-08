const express = require('express');
const { fetchMangaList } = require('../services/mangaService'); // services/mangaからfetchMangaList関数をインポート
const { query, validationResult } = require('express-validator'); // express-validatorから必要な関数をインポート

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    let { keyword = '', offset = '1', direction } = req.query;
    let offsetNum = parseInt(offset, 10) || 1;
    const hits = 100;
    if (direction === 'next') {
      offsetNum += hits;
    } else if (direction === 'prev') {
      offsetNum = Math.max(1, offsetNum - hits);
    }
    console.log(`Received request: keyword=${keyword}, offset=${offsetNum}, direction=${direction}`);
    
    const mangaList = await fetchMangaList(keyword, offsetNum.toString());
    res.json(mangaList);
  } catch (error) {
    console.error('Error fetching manga:', error.message);
    res.status(500).json({ error: 'Failed to fetch manga data' });
  }
});

module.exports = {
  mangaRouter: router
};
