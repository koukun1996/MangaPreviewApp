const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

const API_BASE_URL = 'https://api.dmm.com/affiliate/v3/ItemList';

app.use(cors());
app.use(express.json());

const router = express.Router();

router.get('/search', async (req, res, next) => {
  try {
    const { keyword = '' } = req.query;
    console.log(`Received request with keyword: ${keyword}`); // デバッグ用ログ
    const mangaList = await fetchMangaList(keyword); // 関数名を変更
    res.json(mangaList);
  } catch (error) {
    console.error('FANZA APIから漫画を取得中にエラーが発生しました:', error.message);
    res.status(500).json({ error: '漫画データの取得に失敗しました' });
  }
});

async function fetchMangaList(keyword = '') {
  const apiId = process.env.FANZA_API_ID;
  const affiliateId = process.env.FANZA_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    throw new Error('環境変数にAPI IDまたはアフィリエイトIDが設定されていません');
  }

  const params = {
    api_id: apiId,
    affiliate_id: affiliateId,
    site: 'FANZA',
    service: 'ebook',
    floor: 'comic',
    hits: '100',
    keyword,
    output: 'json'
  };

  try {
    const response = await axios.get(API_BASE_URL, { params });
    return transformApiResponse(response.data);
  } catch (error) {
    console.error('FANZA APIから漫画を取得中にエラーが発生しました:', error.response?.data || error.message);
    throw new Error('漫画データの取得に失敗しました');
  }
}

function transformApiResponse(data) {
  if (!data?.result?.items) {
    return [];
  }

  return data.result.items.map(item => ({
    title: item.title,
    affiliateUrl: item.affiliateURL,
    tachiyomiUrl: item.tachiyomi?.affiliateURL,
    imageUrl: item.imageURL.large
  }));
}

module.exports = {
  fetchMangaList // エクスポート部分を修正
};