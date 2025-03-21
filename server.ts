import 'zone.js/node';
import * as dotenv from 'dotenv';
import { APP_BASE_HREF } from '@angular/common';
import { ngExpressEngine } from '@nguniversal/express-engine';
import express from 'express';
import * as bodyParser from 'body-parser';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { environment } from './src/environments/environment';
import { DatabaseService } from './server/services/database.service';
import { mangaRouter } from './server/routes/manga.routes';
import rateLimit from 'express-rate-limit';
import path from 'path';
// AppComponentのインポートを削除
// import { AppComponent } from './app/app.component';
// main.server.tsからbootstrap関数をインポート
// import { bootstrap } from './src/main.server';
import { AppServerModule } from './src/app/app.server.module';

// サイトマップルーターのインポート
const sitemapRouter = require('./server/routes/sitemap.routes');

// 環境変数を読み込む
dotenv.config();

// MongoDBに接続
const MONGO_URI = process.env['MONGO_URI'] || 'mongodb://admin:your_secure_password@localhost:27017/manga_preview?authSource=admin&directConnection=true';

// モデルファイルを明示的に読み込み
// モデルを先に読み込んでおくことで、アプリケーション全体で一貫したモデルを使用できます
try {
  const mangaModel = require('./server/models/manga.model');
  console.log('Mongooseモデルを読み込みました:', {
    型: typeof mangaModel,
    デフォルト: typeof mangaModel.default,
    キー: Object.keys(mangaModel)
  });
} catch (error) {
  console.error('Mongooseモデルの読み込みエラー:', error);
}

// The Express app is defined but not exported directly
function app(): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), 'dist/MangaPreviewApp/browser');
  const indexHtml = existsSync(join(distFolder, 'index.original.html'))
    ? 'index.original.html'
    : 'index';

  // 'X-Powered-By'ヘッダーを無効化
  server.disable('x-powered-by');

  // trust first proxy
  server.set('trust proxy', 1);

  // レートリミッターの設定
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分間
    max: 100, // 各IPからの最大リクエスト数
  });
  server.use(limiter);

  // リクエストボディのパース設定
  server.use(bodyParser.json({ limit: '10mb' }));
  server.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

  // 'Content-Security-Policy'ヘッダーを削除するミドルウェアを追加
  server.use((req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
  });

  // Our Universal express-engine
  server.engine('html', ngExpressEngine({
    bootstrap: AppServerModule
  }));

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // CORS設定
  server.use((req, res, next) => {
    const allowedOrigin = process.env['ALLOWED_ORIGIN'] || '*';
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    // プリフライトリクエストに対応
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    return next();
  });

  // APIルートの設定
  server.use('/api/manga', mangaRouter);

  // サイトマップルートを追加
  server.use('/', sitemapRouter);

  // Serve static files from /browser
  server.get('*.*', express.static(distFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Universal engine
  server.get('*', (req, res) => {
    res.render(indexHtml, { 
      req,
      providers: [
        { provide: APP_BASE_HREF, useValue: req.baseUrl }
      ]
    });
  });

  return server;
}

// run関数内でappを使用
async function run(): Promise<void> {
  const port = process.env['PORT'] || 4000;

  try {
    // データベースに接続
    await DatabaseService.getInstance().connect(MONGO_URI);
    console.log('MongoDB接続成功');
    
    // Start up the Node server
    const server = app();
    server.listen(port, () => {
      console.log(`Node Express server listening on http://localhost:${port}`);
    });
    
    // エラーハンドリング
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      console.error('Unhandled Rejection:', reason);
    });
    
    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
    });
    
  } catch (error) {
    console.error('サーバー起動エラー:', error);
    process.exit(1);
  }
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run().catch(err => {
    console.error('サーバー実行エラー:', err);
    process.exit(1);
  });
}

// テスト用にアプリをエクスポートする場合は、appをエクスポートしない
// export { app }; // この行を削除
