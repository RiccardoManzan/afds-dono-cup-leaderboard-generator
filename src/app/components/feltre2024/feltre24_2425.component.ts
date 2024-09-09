import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgForm } from '@angular/forms';
import writeXlsxFile from 'write-excel-file';
import {
  customCellMapper,
  CustomConfig,
  customDateMapper,
  mapUnlessEq,
  readFile,
  trimMapper,
} from '../../utils/xls.utils';
import { integerMapper } from 'xlsx-import/lib/mappers';
import { normalizeName } from '../../utils/misc.utils';

@Component({
  selector: 'app-feltre24-2425',
  templateUrl: './feltre24_2425.component.html',
  styleUrls: ['./feltre24_2425.component.scss'],
})
export class Feltre24_2425Component {
  readonly LOAD = 0;
  readonly RESULTS = 1;

  step: number = this.LOAD;

  donationsFile?: File;
  cupSubscribersFile?: File;
  leaderboard: TeamScore[] | undefined;

  @Input() showError: (error: any) => void;
  @Input() isLoading: boolean;
  @Input() initiative: '24' | '24/25' | string;

  @Output() isLoadingChange = new EventEmitter<boolean>();
  public enableFirstDonations: boolean;

  getUnder25BirthdateThreshold(): Date {
    switch (this.initiative) {
      case '24':
        return new Date(1998, 0, 1);
      case '24/25':
        return new Date(1999, 0, 1);
    }
  }

  onDonationsFileChange(event: any) {
    this.donationsFile = event.target.files[0];
  }

  onDonoCupSubscribersFileChange(event: any) {
    this.cupSubscribersFile = event.target.files[0];
  }

  async loadAndGenerate(f: NgForm) {
    this.enableFirstDonations = this.initiative == '24/25';
    f.control.markAllAsTouched();
    if (f.invalid) return;
    if (this.isLoading) return;
    this.isLoadingChange.emit(true);
    try {
      let [donations, cupSubs]: [Donation[], CupSubscription[]] =
        await Promise.all([
          readFile(this.donationsFile!!, config['donations']),
          readFile(this.cupSubscribersFile!!, config['cupSubscriptions']),
        ]);
      console.log(donations.length);

      const duplicateCellsInSubs = cupSubs
        .map((s) => s.cell)
        .reduce((acc, cell, i, arr) => {
          if (arr.indexOf(cell) !== i) acc.push(cell);
          return acc;
        }, []);

      const leaderboardMap = cupSubs.reduce((acc: LeaderboardAcc, sub) => {
        console.debug(
          `RETRIEVING DONATIONS FOR ${sub.name} ${sub.surname} ${sub.cell}`
        );

        const normalizedSubName = normalizeName(sub.name);
        const normalizedSubSurname = normalizeName(sub.surname);

        const theirDonations = donations.filter(
          (donation) =>
          donation.birth.getTime() == sub.birth.getTime() &&
            ((normalizeName(donation.name) == normalizedSubName &&
              normalizeName(donation.surname) == normalizedSubSurname) ||
              (!duplicateCellsInSubs.includes(sub.cell) &&
              donation.cell == sub.cell))
        );
        donations = donations.filter((d) => !theirDonations.includes(d));
        if(theirDonations.length == 0){
          console.log(`No donation found for ${sub.name} ${sub.surname} ${sub.cell}`)
          return acc;
        }

        console.log(
          `${theirDonations.length} donations found for  ${sub.name} ${sub.surname} ${sub.cell}`,
          theirDonations.map((d) => d.donationDate)
        );

        if (!acc[sub.team]) {
          acc[sub.team] = {
            over25BloodDonationsCount: 0,
            under25BloodDonationsCount: 0,
            under25DonorsCount: 0,
            firstDonationsCount: 0
          };
        }
        const teamScore = acc[sub.team];



        const isUnder25 = theirDonations[0].birth.getTime() >= this.getUnder25BirthdateThreshold().getTime();
        if(isUnder25) {
          teamScore.under25BloodDonationsCount += theirDonations.length;
          teamScore.under25DonorsCount++;
        } else {
          teamScore.over25BloodDonationsCount += theirDonations.length;
        }
        //NB: this might not be sufficient if the export used has been generated after the end of the initiative, as the
        //    count might have grown.
        const theyDidTheirFirstDonation = theirDonations.length == theirDonations[0].donationsCount;
        if(theyDidTheirFirstDonation && this.enableFirstDonations){
          teamScore.firstDonationsCount ++;
        }

        return acc;
      }, {});

      console.debug(leaderboardMap);

      this.leaderboard = Object.entries(leaderboardMap)
        .map(
          ([
            teamName,
            {
              over25BloodDonationsCount,
              under25BloodDonationsCount,
              under25DonorsCount,
              firstDonationsCount,
            },
          ]): TeamScore => {
            // noinspection PointlessArithmeticExpressionJS
            return {
              name: teamName,
              over25BloodDonationsCount: over25BloodDonationsCount,
              under25BloodDonationsCount: under25BloodDonationsCount,
              donationsScore: over25BloodDonationsCount * 1 + under25BloodDonationsCount * 2 + firstDonationsCount * 3,
              under25DonorsCount: under25DonorsCount,
              firstDonationsCount: firstDonationsCount,
            };
          }
        )
        .sort((t1, t2) => t2.donationsScore - t1.donationsScore);

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
              column: 'Posizione',
              type: Number,
              value: (ts : PositionedTeamScore) => ts.position,
              width: 8,
            },
            {
              column: 'Squadra',
              type: String,
              value: (ts : PositionedTeamScore) => ts.name,
              width:
                this.leaderboard.reduce((acc, ts) => {
                  console.log(ts.name.length > acc ? ts.name.length : acc);
                  return ts.name.length > acc ? ts.name.length : acc;
                }, 7) + 5,
            },
            {
              column: 'N. donazioni over 25',
              type: Number,
              value: (ts : PositionedTeamScore) => ts.over25BloodDonationsCount,
              width: 26,
            },
            {
              column: 'N. donazioni under 25',
              type: Number,
              value: (ts : PositionedTeamScore) => ts.under25BloodDonationsCount,
              width: 21,
            },
            this.enableFirstDonations ? {
              column: 'N. prime donazioni',
              type: Number,
              value: (ts : PositionedTeamScore) => ts.firstDonationsCount,
              width: 18,
            } : null,
            {
              column: 'Punteggio da donazioni',
              type: Number,
              value: (ts : PositionedTeamScore) => ts.donationsScore,
              width: 22,
            },
            {
              column: 'N. donatori under 25',
              type: Number,
              value: (ts: PositionedTeamScore) => ts.under25DonorsCount,
              width: 20,
            },
          ].filter(it => it != null),
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
  donations: {
    type: 'list',
    worksheet: 'Foglio1',
    rowOffset: 0,
    columns: [
      {index: 1, key: 'donationDate', mapper: mapUnlessEq('Effettuata il', customDateMapper)},
      {index: 2, key: 'birth', mapper: mapUnlessEq('D. Nascita', customDateMapper)},
      {index: 3, key: 'surname', mapper: trimMapper},
      {index: 4, key: 'name', mapper: trimMapper},
      {index: 5, key: 'donationsCount', mapper: mapUnlessEq('N.Don.', integerMapper)},
      {index: 6, key: 'cell', mapper: mapUnlessEq('Telefono Cel', customCellMapper)},
    ],
    name: 'estrazione donazioni',
    headers: {
      donationDate: 'Effettuata il',
      birth: 'D. Nascita',
      surname: 'Cognome',
      name: 'Nome',
      donationsCount: 'N.Don.',
      cell: 'Telefono Cel',
    },
  },
  cupSubscriptions: {
    type: 'list',
    worksheet: 'Iscritti',
    rowOffset: 0,
    columns: [
      {index: 1, key: 'name', mapper: trimMapper},
      {index: 2, key: 'surname', mapper: trimMapper},
      {index: 3, key: 'birth', mapper: mapUnlessEq('Data di Nascita', customDateMapper)},
      {index: 4, key: 'cell', mapper: mapUnlessEq('Telefono', customCellMapper)},
      {index: 5, key: 'team'},
    ],
    name: 'estrazione iscritti alla coppa',
    headers: {
      name: 'Nome',
      surname: 'Cognome',
      birth: 'Data di Nascita',
      cell: 'Telefono',
      team: 'Squadra',
    },
  },
};

type Donation = {
  donationDate: Date;
  birth: Date;
  surname: string;
  name: string;
  donationsCount: number;
  cell: string;
};

type CupSubscription = {
  name: string;
  surname: string;
  birth: Date;
  cell: string;
  team: string;
};

type LeaderboardAcc = { [key: string]: TeamScoreAcc };
type TeamScoreAcc = {
  over25BloodDonationsCount: number;
  under25BloodDonationsCount: number;
  under25DonorsCount: number;
  firstDonationsCount: number;
};
type TeamScore = {
  name: string;
  over25BloodDonationsCount: number;
  under25BloodDonationsCount: number;
  donationsScore: number;
  under25DonorsCount: number;
  firstDonationsCount: number;
};
type PositionedTeamScore = {
  position: number
} & TeamScore

