import { AppServerModule } from './app/app.server.module';
import { enableProdMode, ApplicationRef } from '@angular/core';
import { platformServer } from '@angular/platform-server';

// 開発環境モードを無効化
enableProdMode();

// 単純化したブートストラップ関数
export function bootstrap(): Promise<ApplicationRef> {
  // platformServerを使用してAppServerModuleをブートストラップ
  return platformServer()
    .bootstrapModule(AppServerModule)
    .then(moduleRef => moduleRef.injector.get(ApplicationRef));
}
