const mongoose = require('mongoose');
const importedModel = require('../models/manga.model');
const xml = require('xml');
const moment = require('moment');

// モデルを正しく取得（ESModuleからCommonJSへの変換に対応）
const MangaModel = importedModel.default || importedModel;

// XML形式のサイトマップを生成
exports.generateSitemap = async (req, res) => {
  try {
    console.log('[Controller] サイトマップ生成開始');
    
    // ドメイン名の設定（環境変数から取得するか、デフォルト値を使用）
    const domain = process.env.DOMAIN || 'https://your-domain.com';
    
    // 基本的なURLリスト（静的ページ）
    const staticUrls = [
      { url: [{ loc: domain }], changefreq: 'daily', priority: '1.0' },
      { url: [{ loc: `${domain}/search` }], changefreq: 'daily', priority: '0.8' },
      { url: [{ loc: `${domain}/tags` }], changefreq: 'weekly', priority: '0.7' },
      { url: [{ loc: `${domain}/authors` }], changefreq: 'weekly', priority: '0.7' },
    ];
    
    // 漫画データを取得（最大50,000件まで）
    const mangaItems = await MangaModel.find({})
      .select('fanzaId title updatedAt tags author')
      .sort({ updatedAt: -1 })
      .limit(50000);
    
    console.log(`[Controller] ${mangaItems.length}件の漫画データを取得`);
    
    // 漫画詳細ページのURLを作成
    const mangaUrls = mangaItems.map(manga => {
      // 日本語URLをエンコード
      const encodedId = encodeURIComponent(manga.fanzaId);
      const lastmod = moment(manga.updatedAt).format('YYYY-MM-DD');
      
      return {
        url: [
          { loc: `${domain}/manga/${encodedId}` },
          { lastmod: lastmod },
          { changefreq: 'weekly' },
          { priority: '0.7' }
        ]
      };
    });
    
    // ユニークなタグを収集してタグページのURLを生成
    const uniqueTags = new Set();
    mangaItems.forEach(manga => {
      if (manga.tags && Array.isArray(manga.tags)) {
        manga.tags.forEach(tag => uniqueTags.add(tag));
      }
    });
    
    const tagUrls = Array.from(uniqueTags).map(tag => {
      // 日本語タグ名をエンコード
      const encodedTag = encodeURIComponent(tag);
      
      return {
        url: [
          { loc: `${domain}/tag/${encodedTag}` },
          { changefreq: 'weekly' },
          { priority: '0.6' }
        ]
      };
    });
    
    // ユニークな作者を収集して作者ページのURLを生成
    const uniqueAuthors = new Set();
    mangaItems.forEach(manga => {
      if (manga.author) {
        uniqueAuthors.add(manga.author);
      }
    });
    
    const authorUrls = Array.from(uniqueAuthors).map(author => {
      // 日本語作者名をエンコード
      const encodedAuthor = encodeURIComponent(author);
      
      return {
        url: [
          { loc: `${domain}/author/${encodedAuthor}` },
          { changefreq: 'weekly' },
          { priority: '0.6' }
        ]
      };
    });
    
    // すべてのURLをマージ
    const allUrls = [...staticUrls, ...mangaUrls, ...tagUrls, ...authorUrls];
    
    // XMLフォーマットでサイトマップを生成
    const sitemap = {
      urlset: [
        { _attr: { 
          xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
          'xmlns:xhtml': 'http://www.w3.org/1999/xhtml'
        }},
        ...allUrls
      ]
    };
    
    // XMLレスポンスを送信
    res.header('Content-Type', 'application/xml');
    res.send(xml(sitemap, { declaration: true }));
    
    console.log('[Controller] サイトマップ生成完了');
  } catch (error) {
    console.error('[Controller] サイトマップ生成エラー:', error);
    res.status(500).json({ error: 'サイトマップの生成中にエラーが発生しました' });
  }
};

// サイトマップインデックスを生成（複数のサイトマップがある場合）
exports.generateSitemapIndex = async (req, res) => {
  try {
    // ドメイン名の設定
    const domain = process.env.DOMAIN || 'https://your-domain.com';
    const today = moment().format('YYYY-MM-DD');
    
    // サイトマップインデックスを生成
    const sitemapIndex = {
      sitemapindex: [
        { _attr: { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' } },
        {
          sitemap: [
            { loc: `${domain}/sitemap.xml` },
            { lastmod: today }
          ]
        }
        // 将来的に複数のサイトマップが必要になった場合は、ここに追加
      ]
    };
    
    // XMLレスポンスを送信
    res.header('Content-Type', 'application/xml');
    res.send(xml(sitemapIndex, { declaration: true }));
  } catch (error) {
    console.error('[Controller] サイトマップインデックス生成エラー:', error);
    res.status(500).json({ error: 'サイトマップインデックスの生成中にエラーが発生しました' });
  }
}; 