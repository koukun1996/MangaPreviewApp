# Manga Preview App

## 環境設定

1. `.env.example` ファイルを `.env` にコピーします:
```bash
cp .env.example .env
```

2. `.env` ファイルを編集し、実際のAPIキーとアフィリエイトIDを設定します:
```
FANZA_API_ID=your_api_id_here
FANZA_AFFILIATE_ID=your_affiliate_id_here
```

## 開発サーバーの起動

```bash
npm install
npm start
```

## ビルド

```bash
npm run build
```