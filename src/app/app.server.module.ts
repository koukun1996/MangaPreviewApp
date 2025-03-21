import { NgModule } from '@angular/core';
import { ServerModule, ServerTransferStateModule } from '@angular/platform-server';
import { AppModule } from './app.module';
import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    AppModule,
    RouterModule,
    ServerModule,
    ServerTransferStateModule
  ],
  bootstrap: [AppComponent]
})
export class AppServerModule {} 