import { Component } from '@angular/core';
import { async } from 'rxjs';

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

  isLoading: boolean = false;

  reload() {
    location.reload();
  }

  loadAndGenerate(){
    this.isLoading = true
    setTimeout(() => alert("//TODO: GENERATE LEADERBOARD"), 50)
  }
}
