import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Workbook } from 'exceljs';
import { IListSourceConfig } from 'xlsx-import/lib/config/IListSourceConfig';
import { Importer } from 'xlsx-import/lib/Importer';
import * as CodiceFiscaleUtils from '@marketto/codice-fiscale-utils';
import writeXlsxFile from 'write-excel-file';

@Component({
  selector: 'app-afdvs2024',
  templateUrl: './afdvs2024.component.html',
  styleUrls: ['./afdvs2024.component.scss']
})
export class Afdvs2024Component {
  readonly LOAD = 0;
  readonly RESULTS = 1;

  step: number = this.LOAD;

  donorsFile?: File;
  donationsFile?: File;
  cupSubscribersFile?: File;
  leaderboard: TeamScore[] | undefined;

  @Input() showError: (error: any) => void
  @Input() isLoading: boolean;
  @Output() isLoadingChange = new EventEmitter<boolean>();


  onDonorsFileChange(event: any) {
    this.donorsFile = event.target.files[0];
  }
  onDonationsFileChange(event: any) {
    this.donationsFile = event.target.files[0];
  }
  onDonoCupSubscribersFileChange(event: any) {
    this.cupSubscribersFile = event.target.files[0];
  }



  readFile(file: File, config: CustomConfig) {
    return new Promise<any[]>((res, rej) => {
      let fileReader = new FileReader();
      fileReader.onloadend = async (_) => {
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
    this.isLoadingChange.emit(true);
    try {
      const [donors, donations, cupSubs] = await Promise.all([
        this.readFile(this.donorsFile!!, config['donors']) as Promise<Donor[]>,
        this.readFile(this.donationsFile!!, config['donations']).then(
          (donations: Donation[]) =>
            donations.filter(
              (d) =>
                d.date.getTime() >= this.startDate.getTime() &&
                d.date.getTime() <= this.endDate.getTime()
            )
        ),
        this.readFile(
          this.cupSubscribersFile!!,
          config['cupSubscriptions']
        ) as Promise<CupSubscription[]>,
      ]);
      console.log(donations.length);
      const leaderboardMap = donations.reduce(
        (acc: LeaderboardAcc, donation) => {
          console.debug(
            `CHECKING DONATION FOR ${donation.cardNumber} ${donation.date}`
          );
          const sub = cupSubs.find((s) => s.cardNumber == donation.cardNumber);
          console.debug(
            sub
              ? `found subscription for ${donation.cardNumber} with team ${sub.team}`
              : `Subscription not found for ${donation.cardNumber}`
          );
          if (!sub) return acc;
          const donor = donors.find((d) => d.cardNumber == donation.cardNumber);
          if (!donor) {
            console.debug(
              `donor not found for card number ${donation.cardNumber}`
            );
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
            console.debug(
              `cf not consistent with donor for ${donor.cardNumber}`
            );
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
          if (donor.birth.getTime() >= stringToDate('01/01/1998').getTime()) {
            console.debug(`donor ${donor.cardNumber} is under 25`);
            teamScore.donorsUnder25CardNumbers.add(donor.cardNumber);
          }
          return acc;
        },
        {}
      );

      console.debug(leaderboardMap);

      this.leaderboard = Object.entries(leaderboardMap)
        .map((entry): TeamScore => {
          const [
            teamName,
            {
              entireBloodDonationsCount,
              plasmaDonationsCount,
              otherDonationsCount,
              donorsUnder25CardNumbers,
            },
          ] = entry;
          return {
            name: teamName,
            entireBloodDonationsCount: entireBloodDonationsCount,
            plasmaDonationsCount: plasmaDonationsCount,
            otherDonationsCount: otherDonationsCount,
            donationsScore:
              entireBloodDonationsCount * 1 +
              plasmaDonationsCount * 2 +
              otherDonationsCount * 2,
            donorsUnder25Count: donorsUnder25CardNumbers.size,
          };
        })
        .sort((t1, t2) => t2.donationsScore - t1.donationsScore);
      //First the ones with bigger donation score.

      this.step = this.RESULTS;
    this.isLoadingChange.emit(false);
    } catch (ex) {
      console.error(ex);
      this.showError(ex);
    this.isLoadingChange.emit(false);
    }
  }

  async downloadFullLeaderboard() {
    try {
      writeXlsxFile(
        this.leaderboard.map((ts, index) => ({
          position: index + 1,
          ...ts,
        })),
        {
          fileName: 'leaderboard.xlsx',
          schema: [
            {
              column: 'Position',
              type: Number,
              value: (ts) => ts.position,
              width: 8,
            },
            {
              column: 'Squadra',
              type: String,
              value: (ts) => ts.name,
              width: this.leaderboard.reduce(
                (acc, ts) =>{ console.log((ts.name.length > acc ? ts.name.length : acc)); return (ts.name.length > acc ? ts.name.length : acc)},
                7
              ) + 5,
            },
            {
              column: 'N. donazioni sangue intero',
              type: Number,
              value: (ts) => ts.entireBloodDonationsCount,
              width: 26,
            },
            {
              column: 'N. donazione plasma da aferesi',
              type: Number,
              value: (ts) => ts.plasmaDonationsCount,
              width: 30,
            },
            {
              column: 'N. altre donazioni',
              type: Number,
              value: (ts) => ts.otherDonationsCount,
              width: 18,
            },
            {
              column: 'Punteggio da donazioni',
              type: Number,
              value: (ts) => ts.donationsScore,
              width: 22,
            },
            {
              column: 'Donatori under 25',
              type: Number,
              value: (ts) => ts.donorsUnder25Count,
              width: 17,
            },
          ],
        }
      );
    } catch (ex) {
      console.error(ex);
      this.showError(ex);
      this.isLoadingChange.emit(false);
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
        mapper: (v: string) => (v == 'Data Donazione' ? v : stringToDate(v)),
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

type LeaderboardAcc = { [key: string]: TeamScoreAcc };
type TeamScoreAcc = {
  entireBloodDonationsCount: number;
  plasmaDonationsCount: number;
  otherDonationsCount: number;
  donorsUnder25CardNumbers: Set<string>;
};
type TeamScore = {
  name: string;
  entireBloodDonationsCount: number;
  plasmaDonationsCount: number;
  otherDonationsCount: number;
  donationsScore: number;
  donorsUnder25Count: number;
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

