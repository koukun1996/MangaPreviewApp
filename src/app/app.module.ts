import { NgModule } from '@angular/core';
import { BrowserModule, Title, Meta } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AppRoutingModule, routes } from './app-routing.module';
import { CommonModule } from '@angular/common';
import { AppComponent } from './app.component';
import { RouterOutlet } from '@angular/router';

import { SeoService } from './services/seo.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule.withServerTransition({ appId: 'mangaPreviewApp' }),
    RouterModule.forRoot(routes),
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    CommonModule,
    RouterOutlet
  ],
  exports: [
    AppComponent
  ],
  providers: [
    Title,
    Meta,
    SeoService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { } 