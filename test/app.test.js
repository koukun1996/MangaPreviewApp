const request = require('supertest');
const app = require('../server/index'); // Express アプリケーションをインポート

describe('GET /', () => {
  it('should return 200 OK', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    // 必要に応じて追加のテストを行います
  });
});

// 他のテストケースを追加
