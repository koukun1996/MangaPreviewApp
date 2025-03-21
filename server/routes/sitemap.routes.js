const express = require('express');
const router = express.Router();
const sitemapController = require('../controllers/sitemap.controller');

// サイトマップを生成するエンドポイント
router.get('/sitemap.xml', sitemapController.generateSitemap);

// サイトマップインデックスを生成するエンドポイント（複数のサイトマップがある場合）
router.get('/sitemap-index.xml', sitemapController.generateSitemapIndex);

module.exports = router; 