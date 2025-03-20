const express = require('express');
const router = express.Router();
const mangaController = require('../controllers/manga.controller');
const fanzaController = require('../controllers/fanza.controller');

// 漫画データの保存
router.post('/save', mangaController.saveManga);

// キーワード検索
router.post('/search/keywords', mangaController.searchByKeywords);

// 組み合わせ検索
router.post('/search/combination', mangaController.searchByCombination);

// タグまたは作者による検索 - メインのAPIエンドポイント
router.get('/search', mangaController.searchByTagsOrAuthor);

// レコメンデーション取得エンドポイント
router.get('/recommendations', mangaController.getRecommendations);

// ジャンル検索 - パスを正しく修正
router.get('/searchByGenre', mangaController.searchByGenre);

// 複合検索 - パスを正しく修正
router.get('/searchCombined', mangaController.searchCombined);

// ジャンル一覧とカウント取得エンドポイント
router.get('/genres', mangaController.getGenreCounts);

// 組み合わせリストの取得
router.get('/combinations', mangaController.getAllCombinations);

// 人気の組み合わせの取得
router.get('/combinations/popular', mangaController.getPopularCombinations);

// バルクインポート
router.post('/bulk-import', mangaController.bulkImport);

// FANZA APIからインポート（管理者用） - このエンドポイントは管理機能のため残す
router.post('/import-from-fanza', fanzaController.importFromFanza);

// IDで漫画を取得（SEO対応）
router.get('/:id', mangaController.getMangaById);

// server.tsとの互換性のためにオブジェクトとしてエクスポート
module.exports = {
  mangaRouter: router
}; 