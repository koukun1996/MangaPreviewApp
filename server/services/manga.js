const axios = require('axios');

const API_BASE_URL = 'https://api.dmm.com/affiliate/v3/ItemList';

async function getMangaList(keyword = '', offset = 1) {
  try {
    const params = {
      api_id: process.env.FANZA_API_ID,
      affiliate_id: process.env.FANZA_AFFILIATE_ID,
      site: 'FANZA',
      service: 'ebook',
      floor: 'comic',
      hits: '100',
      offset: offset.toString(),
      keyword,
      output: 'json'
    };

    const response = await axios.get(API_BASE_URL, { params });
    return transformApiResponse(response.data);
  } catch (error) {
    console.error('Error fetching manga from FANZA API:', error);
    throw new Error('Failed to fetch manga data');
  }
}

function transformApiResponse(data) {
  if (!data?.result?.items) {
    return [];
  }

  return data.result.items.map(item => ({
    title: item.title,
    imageUrl: item.imageURL?.list || '',
    affiliateUrl: item.affiliateURL,
    contentId: item.content_id,
    sampleImageUrls: [],
    tachiyomiUrl: item.tachiyomi?.affiliateURL
  }));
}

module.exports = {
  getMangaList
};