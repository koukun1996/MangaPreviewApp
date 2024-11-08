# ベースステージ：依存関係のインストール
FROM node:18 AS base
WORKDIR /app
COPY package*.json ./

# 開発依存関係も含めてインストール
RUN npm ci

# ビルドステージ：Angularアプリケーションのビルド
FROM base AS build
COPY . .
# 環境変数を設定（必要に応じて）
ARG configuration=production
RUN npm run build -- --configuration=$configuration

# 本番環境ステージ：軽量なランタイムイメージを使用
FROM node:18-alpine AS production
WORKDIR /app

# 必要なファイルのみをコピー
COPY --from=build /app/server ./server
COPY --from=build /app/dist/demo/browser ./server/public/browser

# プロダクション依存関係のみをインストール
COPY package*.json ./
RUN npm ci --only=production

# ファイルの所有者とパーミッションを設定
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server/index.js"]
