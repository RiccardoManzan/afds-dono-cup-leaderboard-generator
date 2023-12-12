import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { Afds2023Component } from './components/afds2023/afds2023.component';
import { Afdvs2024Component } from './components/afdvs2024/afdvs2024.component';

@NgModule({
  declarations: [
    AppComponent,
    Afds2023Component,
    Afdvs2024Component,
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
