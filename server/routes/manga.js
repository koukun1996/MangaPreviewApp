const express = require('express');
const { getMangaList } = require('../services/manga');

const router = express.Router();

router.get('/search', async (req, res, next) => {
  try {
    const { keyword = '', offset = 1 } = req.query;
    const mangaList = await getMangaList(keyword, offset);
    res.json(mangaList);
  } catch (error) {
    next(error);
  }
});

module.exports = {
  mangaRouter: router
};