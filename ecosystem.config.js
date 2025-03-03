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
  }]
}; 