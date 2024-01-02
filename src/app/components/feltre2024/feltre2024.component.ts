import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgForm } from '@angular/forms';
import writeXlsxFile from 'write-excel-file';
import {
  customCellMapper,
  CustomConfig,
  customDateMapper,
  mapUnlessEq,
  readFile,
  trimMapper
} from "../../utils/xls.utils";
import { integerMapper } from "xlsx-import/lib/mappers";
import { normalizeName } from "../../utils/misc.utils";

const UNDER25_BIRTH_THRESHOLD = customDateMapper('01/01/1998');

@Component({
  selector: 'app-feltre2024',
  templateUrl: './feltre2024.component.html',
  styleUrls: ['./feltre2024.component.scss']
})
export class Feltre2024Component {
  readonly LOAD = 0;
  readonly RESULTS = 1;

  step: number = this.LOAD;

  donationsFile?: File;
  cupSubscribersFile?: File;
  leaderboard: TeamScore[] | undefined;

  @Input() showError: (error: any) => void
  @Input() isLoading: boolean;
  @Output() isLoadingChange = new EventEmitter<boolean>();

  onDonationsFileChange(event: any) {
    this.donationsFile = event.target.files[0];
  }

  onDonoCupSubscribersFileChange(event: any) {
    this.cupSubscribersFile = event.target.files[0];
  }

  async loadAndGenerate(f: NgForm) {
    f.control.markAllAsTouched();
    if (f.invalid) return;
    if (this.isLoading) return;
    this.isLoadingChange.emit(true);
    try {
      const [donations, cupSubs]: [Donation[], CupSubscription[]] = await Promise.all([
        readFile(this.donationsFile!!, config['donations']),
        readFile(this.cupSubscribersFile!!, config['cupSubscriptions'])
      ]);
      console.log(donations.length);
      const leaderboardMap = donations.reduce(
        (acc: LeaderboardAcc, donation) => {

          //Bonus 6 sostenitori under25 -> 30 punti // solo se ha già 40 punti
          //ignora se trovi lo stesso cell in più squadre
          //donazione 1 punto, 2 punti se under25
          //conteggio sostenitori under25 x spareggio


          console.debug(
            `CHECKING DONATION FOR ${donation.name} ${donation.surname} ${donation.cell} ${donation.donationDate}`
          );
          const normalizedDonationName = normalizeName(donation.name)
          const normalizedDonationSurname = normalizeName(donation.surname)
          const subs = cupSubs.filter((s) =>
              s.birth.getDate() == donation.birth.getDate()
              && (
                (normalizeName(s.name) == normalizedDonationName && normalizeName(s.surname) == normalizedDonationSurname)
                || s.cell == donation.cell
              )
          );
          if (subs.length > 1) {
            console.warn(`Found multiple subscriptions for the donation ${JSON.stringify(donation)} : ${JSON.stringify(subs)}`)
            //TODO: HANDLE THIS CASE BETTER: WE SHOULD WARN USER ABOUT THESE CASES
            return acc
          }
          const sub = subs[0]
          console.debug(
            sub
              ? `found subscription for ${donation.name} ${donation.surname} ${donation.cell} who donated in ${donation.donationDate} with team ${sub.team}`
              : `Subscription not found for ${donation.name} ${donation.surname} ${donation.cell} who donated in ${donation.donationDate}`
          );
          if (!sub) return acc;

          if (!acc[sub.team]) {
            acc[sub.team] = {
              over25BloodDonationsCount: 0,
              under25BloodDonationsCount: 0,
              donorsUnder25CellNumbers: new Set(),
            };
          }
          const teamScore = acc[sub.team];
          if (donation.birth.getTime() >= UNDER25_BIRTH_THRESHOLD.getTime()) {
            teamScore.under25BloodDonationsCount++;
            // NOTE: This is not the best, but it should be sufficient if we consider donations export consistent:
            //       a donor should not be able to figure in different subscriptions, even if the lookup is not strong
            //       as I would like
            teamScore.donorsUnder25CellNumbers.add(sub.cell);
          } else {
            teamScore.over25BloodDonationsCount++;
          }
          return acc;
        },
        {}
      );

      console.debug(leaderboardMap);

      this.leaderboard = Object.entries(leaderboardMap)
        .map(
          ([teamName, {
            over25BloodDonationsCount,
            under25BloodDonationsCount,
            donorsUnder25CellNumbers
          },]): TeamScore => {
            // noinspection PointlessArithmeticExpressionJS
            return {
              name: teamName,
              over25BloodDonationsCount: over25BloodDonationsCount,
              under25BloodDonationsCount: under25BloodDonationsCount,

              donationsScore:
                over25BloodDonationsCount * 1 +
                under25BloodDonationsCount * 2,
              under25DonorsCount: donorsUnder25CellNumbers.size,
            };
          }
        )
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
              column: 'Posizione',
              type: Number,
              value: (ts) => ts.position,
              width: 8,
            },
            {
              column: 'Squadra',
              type: String,
              value: (ts) => ts.name,
              width: this.leaderboard.reduce(
                (acc, ts) => {
                  console.log((ts.name.length > acc ? ts.name.length : acc));
                  return (ts.name.length > acc ? ts.name.length : acc)
                },
                7
              ) + 5,
            },
            {
              column: 'N. donazioni over 25',
              type: Number,
              value: (ts) => ts.over25BloodDonationsCount,
              width: 26,
            },
            {
              column: 'N. donazioni under 25',
              type: Number,
              value: (ts) => ts.under25BloodDonationsCount,
              width: 21,
            },
            {
              column: 'Punteggio da donazioni',
              type: Number,
              value: (ts) => ts.donationsScore,
              width: 22,
            },
            {
              column: 'N. donatori under 25',
              type: Number,
              value: (ts) => ts.under25DonorsCount,
              width: 20,
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
  donationDate: Date
  birth: Date
  surname: string
  name: string
  donationsCount: number
  cell: string;
};

type CupSubscription = {
  name: string;
  surname: string;
  birth: Date
  cell: string;
  team: string;
};

type LeaderboardAcc = { [key: string]: TeamScoreAcc };
type TeamScoreAcc = {
  over25BloodDonationsCount: number;
  under25BloodDonationsCount: number;
  donorsUnder25CellNumbers: Set<string>
};
type TeamScore = {
  name: string;
  over25BloodDonationsCount: number;
  under25BloodDonationsCount: number;
  donationsScore: number;
  under25DonorsCount: number;
};

