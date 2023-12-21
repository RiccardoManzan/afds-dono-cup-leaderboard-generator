import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { Friuli2023n2024Component } from './components/friuli2023n2024/friuli2023n2024.component';
import { Feltre2024Component } from './components/feltre2024/feltre2024.component';

@NgModule({
  declarations: [
    AppComponent,
    Friuli2023n2024Component,
    Feltre2024Component,
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
