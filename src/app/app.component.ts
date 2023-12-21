import { Component, TemplateRef, ViewChild } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  @ViewChild('errorModal') errorModal: TemplateRef<any> | undefined;

  initiative: Initiative | null = null;
  error: string | any;
  isLoading: boolean = false;

  constructor(private modalService: NgbModal) {}

  reload() {
    location.reload();
  }

  showError(error: any) {
    this.error = error;
    this.modalService.open(this.errorModal);
  }

  setInitiative(initiative: Initiative) {
    this.initiative = initiative;
  }
}

type Initiative = 'AFDS2023' | 'AFDVS2024' | 'AFDS2024';
