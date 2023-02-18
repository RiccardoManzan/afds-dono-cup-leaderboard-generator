import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  ENTRYPOINT = 0;
  LOAD = 1;
  RESULTS = 2;
  step: number = this.ENTRYPOINT;

  reload() {
    location.reload();
  }
}
