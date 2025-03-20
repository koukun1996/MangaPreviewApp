module.exports = {
  apps: [{
    name: 'manga-preview-ssr',
    script: 'dist/MangaPreviewApp/server/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    max_memory_restart: '1G'
  },
  {
    name: 'manga-data-fetcher',
    script: 'scripts/fetchFanzaData.ts',
    interpreter: 'node',
    interpreter_args: '-r ts-node/register',
    instances: 1,
    exec_mode: 'fork',
    cron_restart: '0 3 * * *', // 毎日午前3時に実行
    watch: false,
    autorestart: false
  }]
}; 