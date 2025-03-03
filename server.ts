import 'zone.js/node';
import * as dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config();

import { APP_BASE_HREF } from '@angular/common';
import { ngExpressEngine } from '@nguniversal/express-engine';
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import bootstrap from './src/main.server';

// mangaServiceをインポート
import { fetchMangaList } from './server/services/mangaService';

export function app(): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), 'dist/MangaPreviewApp/browser');
  const indexHtml = existsSync(join(distFolder, 'index.original.html'))
    ? 'index.original.html'
    : 'index';

  // APIエンドポイントの定義
  const apiHandler = async (req: express.Request, res: express.Response) => {
    try {
      const keyword = (req.query['keyword'] as string) || '';
      const offset = (req.query['offset'] as string) || '1';
      
      try {
        const mangaList = await fetchMangaList(keyword, offset);
        
        if (mangaList.length === 0 && process.env['NODE_ENV'] === 'development') {
          // 開発環境でのみダミーデータを返す
          return res.json([
            createDummyManga(parseInt(offset, 10)),
            createDummyManga(parseInt(offset, 10) + 1)
          ]);
        }
        
        return res.json(mangaList);
      } catch (error: any) {
        console.error('漫画データ取得エラー:', error.message);
        return res.status(500).json({ 
          error: '漫画データの取得に失敗しました'
        });
      }
    } catch (error: any) {
      console.error('APIハンドラーエラー:', error.message);
      return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
  };

  // API エンドポイントを登録
  server.get('/api/manga', apiHandler);
  server.get('/manga', apiHandler);

  // CORS設定
  server.use((req, res, next) => {
    const allowedOrigin = process.env['ALLOWED_ORIGIN'] || '*';
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // Universal engine設定
  server.engine('html', ngExpressEngine({
    bootstrap
  }));

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // 静的ファイル提供
  server.get('*.*', express.static(distFolder, {
    maxAge: '1y'
  }));

  // Angular Universalでレンダリング
  server.get('*', (req, res) => {
    res.render(indexHtml, {
      req,
      providers: [{ provide: APP_BASE_HREF, useValue: req.baseUrl }]
    });
  });

  return server;
}

/**
 * 開発環境用のダミー漫画データを生成する
 */
function createDummyManga(offset: number) {
  return {
    title: `ダミー漫画 ${offset}`,
    imageUrl: `https://picsum.photos/200/300?random=${offset}`,
    affiliateUrl: 'https://example.com',
    contentId: `dummy-content-${offset}`,
    sampleImageUrls: [
      `https://picsum.photos/200/300?random=${offset}`,
      `https://picsum.photos/200/300?random=${offset+100}`
    ],
    tachiyomiUrl: 'https://example.com/tachiyomi',
    offset
  };
}

function run(): void {
  const port = process.env['PORT'] || 3001;

  // サーバー起動
  const server = app();
  server.listen(port, () => {
    console.log(`サーバー起動: http://localhost:${port}`);
  });
}

// Webpackによる置換処理
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}

export default bootstrap;
