import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { FriuliComponent } from './components/friuli/friuli.component';
import { Feltre24_2425Component } from './components/feltre2024/feltre24_2425.component';

@NgModule({
  declarations: [
    AppComponent,
    FriuliComponent,
    Feltre24_2425Component,
  ],
  imports: [
    BrowserModule,
    NgbModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
