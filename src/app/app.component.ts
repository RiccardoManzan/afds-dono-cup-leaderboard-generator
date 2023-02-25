import { Component, TemplateRef, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
// import * as XLSX from 'xlsx';
import { Workbook, Buffer } from 'exceljs';
import { IListSourceConfig } from 'xlsx-import/lib/config/IListSourceConfig';
import { Importer } from 'xlsx-import/lib/Importer';
import * as CodiceFiscaleUtils from '@marketto/codice-fiscale-utils';
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

  startDate = stringToDate('01/02/2023');
  endDate = stringToDate('30/06/2023');

  async loadAndGenerate(f: NgForm) {
    f.control.markAllAsTouched();
    if (f.invalid) return;
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      const [donors, donations, cupSubs] = await Promise.all([
        this.readFile(this.donorsFile!!, config['donors']) as Promise<Donor[]>,
        this.readFile(this.donationsFile!!, config['donations']).then(
          (donations: Donation[]) =>
            donations.filter(
              (d) =>
                d.date.getTime() > this.startDate.getTime() &&
                d.date.getTime() < this.startDate.getTime()
            )
        ),
        this.readFile(
          this.cupSubscribersFile!!,
          config['cupSubscriptions']
        ) as Promise<CupSubscription[]>,
      ]);

      const leaderboardMap = donations.reduce(
        (acc: LeaderboardMap, donation) => {
          const sub = cupSubs.find((s) => s.cardNumber == donation.cardNumber);
          if (!sub) return acc;
          const donor = donors.find((d) => d.cardNumber == donation.cardNumber);
          if (!donor) {
            //TODO add to error file output
            return acc;
          }
          const cfValidator = CodiceFiscaleUtils.Validator.codiceFiscale(
            sub.cf
          );
          //Note: Not checking name and lastname here as this would be more likely to fail. We've got already a decent logic to fight against fake subscriptions.
          const isCFNotConsistentWithDonor =
            !cfValidator.matchBirthDate(donor.birth) ||
            !cfValidator.matchGender(donor.sex);
          if (isCFNotConsistentWithDonor) {
            //TODO add to probably wrong user subscriptions
            return acc;
          }
          var teamScore = acc[sub.team];
          if (!teamScore) {
            acc[sub.team] = {
              entireBloodDonationsCount: 0,
              plasmaDonationsCount: 0,
              otherDonationsCount: 0,
              donorsUnder25CardNumbers: new Set(),
              donors18To25CardNumbers: new Set(),
            };
            teamScore = acc[sub.team];
          }
          switch (donation.type) {
            case 'Sangue Intero':
              teamScore.entireBloodDonationsCount++;
              break;
            case 'Plasma da aferesi':
              teamScore.plasmaDonationsCount++;
              break;
            default:
              teamScore.otherDonationsCount++;
          }
          if (donor.birth.getTime() < stringToDate('01/01/1998').getTime()) {
            //under25
            teamScore.donorsUnder25CardNumbers.add(donor.cardNumber);
            if (donor.birth.getTime() > stringToDate('01/01/2003').getTime()) {
              //over18
              teamScore.donors18To25CardNumbers.add(donor.cardNumber);
            }
          }
          return acc;
        },
        {}
      );

      console.log(leaderboardMap);
    } catch (ex) {
      console.error(ex);
      this.showError(ex);
      this.isLoading = false;
    }
  }
}

const config: { [key: string]: CustomConfig } = {
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
        mapper: (v: string) => (v == 'Dt. Nasc.' ? v : stringToDate(v)),
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
      {
        index: 3,
        key: 'date',
        mapper: (v: string) => (v == 'Dt. Nasc.' ? v : stringToDate(v)),
      },
      { index: 8, key: 'type' },
    ],
    name: 'estrazione donazioni',
    headers: {
      cardNumber: 'Num. Tess.',
      date: 'Data Donazione',
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

type CustomConfig = {
  name: string;
  headers: any;
} & IListSourceConfig;

type Donor = {
  cardNumber: string;
  nominative: string;
  sex: 'M' | 'F';
  birth: Date;
};

type Donation = {
  cardNumber: string;
  date: Date;
  type: 'Plasma da aferesi' | 'Sangue Intero' | string;
};

type CupSubscription = {
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

type LeaderboardMap = { [key: string]: TeamScore };
type TeamScore = {
  entireBloodDonationsCount: number;
  plasmaDonationsCount: number;
  otherDonationsCount: number;
  donorsUnder25CardNumbers: Set<string>;
  donors18To25CardNumbers: Set<string>;
};

function equalsByValue(obj1: any, obj2: any): boolean {
  const obj1Keys = Object.keys(obj1);
  const obj2Keys = Object.keys(obj2);

  return (
    obj1Keys.length === obj2Keys.length &&
    obj1Keys.every((key) => obj1[key] == obj2[key])
  );
}

function stringToDate(dateString: string) {
  const [day, month, year] = dateString.split('/');
  return new Date([month, day, year].join('/'));
}
