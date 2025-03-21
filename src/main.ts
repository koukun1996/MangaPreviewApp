import 'zone.js';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

// NgModuleベースのアプリケーション初期化
platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));

// SSRを使用している場合、エクスポートを適切なESM形式にする
export function bootstrap() {
  return platformBrowserDynamic().bootstrapModule(AppModule);
}