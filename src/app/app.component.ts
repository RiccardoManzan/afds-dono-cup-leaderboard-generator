import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
// import * as XLSX from 'xlsx';
import { Workbook, Buffer } from 'exceljs';
import { IListSourceConfig } from 'xlsx-import/lib/config/IListSourceConfig';
import { Importer } from 'xlsx-import/lib/Importer';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  readonly ENTRYPOINT = 0;
  readonly LOAD = 1;
  readonly RESULTS = 2;

  step: number = this.ENTRYPOINT;

  isLoading: boolean = false;
  donorsFile?: File;
  donationsFile?: File;
  donoCupSubscribersFile?: File;

  reload() {
    location.reload();
  }

  onDonorsFileChange(event: any) {
    this.donorsFile = event.target.files[0];
  }
  onDonationsFileChange(event: any) {
    this.donationsFile = event.target.files[0];
  }
  onDonoCupSubscribersFileChange(event: any) {
    this.donoCupSubscribersFile = event.target.files[0];
  }

  readFile(file: File, config: IListSourceConfig) {
    return new Promise((res, rej) => {
      let fileReader = new FileReader();
      fileReader.onloadend = async (e) => {
        console.log('aaa');

        const wb = new Workbook();
        await wb.xlsx.load(fileReader.result as ArrayBuffer);
        const importer = new Importer(wb);

        const res = importer.getAllItems(config);
        console.log(res);
      };
      fileReader.readAsArrayBuffer(file);
    });
  }

  async loadAndGenerate(f: NgForm) {
    // f.control.markAllAsTouched();
    // if (f.invalid) return;
    // if (this.isLoading) return;
    // this.isLoading = true;


    const [donors, donations, cupSubs] = await Promise.all([
      this.readFile(this.donorsFile!!, this.config['donors']),
      Promise.resolve([]),
      Promise.resolve([])
      // this.readFile(this.donationsFile!!, this.config['donations']),
      // this.readFile(
        //   this.donoCupSubscribersFile!!,
        //   this.config['donoCupSubscribers']
        // ),
      ]);
      //Check what happens with wrong formatted files
      //Basic error handling for bad formatted files
    }

  readonly config: { [key: string]: IListSourceConfig } = {
    donors: {
      type: 'list',
      worksheet: 'Sheet',
      columns: [
        { index: 1, key: 'cardNumber' },
        { index: 2, key: 'nominative' },
        { index: 3, key: 'sex' },
        { index: 4, key: 'birth', mapper: (v: string) => new Date(v) },
      ],
      rowOffset: 1, // offset header row
    },
  };
}

type Donor = {
  cardNumber: string;
  nominative: string;
  sex: 'M' | 'F';
  birth: Date;
};
