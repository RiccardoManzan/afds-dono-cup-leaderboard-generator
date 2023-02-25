import { Component, TemplateRef, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
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
  cupSubscribersFile?: File;
  error: string | any;

  @ViewChild('errorModal') errorModal: TemplateRef<any> | undefined;

  constructor(private modalService: NgbModal) {}

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
    this.cupSubscribersFile = event.target.files[0];
  }

  showError(error: any) {
    this.error = error;
    this.modalService.open(this.errorModal);
  }

  readFile(file: File, config: CustomConfig) {
    return new Promise<any[]>((res, rej) => {
      let fileReader = new FileReader();
      fileReader.onloadend = async (e) => {
        try {
          const wb = new Workbook();
          await wb.xlsx.load(fileReader.result as ArrayBuffer);
          const importer = new Importer(wb);
          const items = importer.getAllItems(config);
          const headers = items.shift();
          console.debug(
            headers,
            config.headers,
            equalsByValue(headers, config.headers)
          );
          if (!equalsByValue(headers, config.headers)) {
            throw `Contenuto del file non valido`;
          }
          console.debug(items);
          res(items);
        } catch (ex) {
          console.error(ex);
          rej(`Errore durante la lettura del file ${config.name}: ${ex}`);
        }
      };
      fileReader.readAsArrayBuffer(file);
    });
  }

  async loadAndGenerate(f: NgForm) {
    f.control.markAllAsTouched();
    if (f.invalid) return;
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      const [donors, donations, cupSubs] = await Promise.all([
        this.readFile(this.donorsFile!!, this.config['donors']),
        this.readFile(this.donationsFile!!, this.config['donations']),
        this.readFile(
          this.cupSubscribersFile!!,
          this.config['cupSubscriptions']
        ),
      ]);
      console.log(donors, donations, cupSubs);
    } catch (ex) {
      console.error(ex);
      this.showError(ex);
      this.isLoading = false
    }
  }

  readonly config: { [key: string]: CustomConfig } = {
    donors: {
      type: 'list',
      worksheet: 'Sheet',
      rowOffset: 0,
      columns: [
        { index: 1, key: 'cardNumber' },
        { index: 2, key: 'nominative' },
        { index: 3, key: 'sex' },
        {
          index: 4,
          key: 'birth',
          mapper: (v: string) => (v == 'Dt. Nasc.' ? v : new Date(v)),
        },
      ],
      name: 'estrazione donatori',
      headers: {
        cardNumber: 'Num. Tess.',
        nominative: 'Cognome e Nome',
        sex: 'Sesso',
        birth: 'Dt. Nasc.',
      },
    },
    donations: {
      type: 'list',
      worksheet: 'Sheet',
      rowOffset: 0,
      columns: [
        { index: 1, key: 'cardNumber' },
        { index: 8, key: 'type' },
      ],
      name: 'estrazione donazioni',
      headers: {
        cardNumber: 'Num. Tess.',
        type: 'Tipo',
      },
    },
    cupSubscriptions: {
      type: 'list',
      worksheet: 'Iscritti',
      rowOffset: 0,
      columns: [
        { index: 1, key: 'Name' },
        { index: 2, key: 'Surname' },
        { index: 3, key: 'cardNumber' },
        { index: 4, key: 'cf' },
        { index: 7, key: 'team' },
      ],
      name: 'estrazione iscritti alla coppa',
      headers: {
        Name: 'Nome',
        Surname: 'Cognome',
        cardNumber: 'Numero Tessera',
        cf: 'Codice Fiscale',
        team: 'Squadra',
      },
    },
  };
}

type CustomConfig = {
  name: string;
  headers: any;
} & IListSourceConfig;

type Donor = {
  cardNumber: string;
  nominative: string;
  sex: 'M' | 'F';
  birth: Date | string;
};

type Donation = {
  cardNumber: string;
  type: 'Plasma da aferesi' | 'Sangue Intero' | string;
};

type cupSubscription = {
  Name: string;
  Surname: string;
  cardNumber: string;
  cf: string;
  team: string;
};

type Result = {
  team: string;
  entireBloodDonationsCount: number;
  plasmaDonationsCount: number;
  score: number;
};

function equalsByValue(obj1: any, obj2: any): boolean {
  const obj1Keys = Object.keys(obj1);
  const obj2Keys = Object.keys(obj2);

  return (
    obj1Keys.length === obj2Keys.length &&
    obj1Keys.every((key) => obj1[key] == obj2[key])
  );
}
