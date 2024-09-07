import { Workbook } from 'exceljs';
import { Importer } from 'xlsx-import/lib/Importer';
import { equalsByValue } from './misc.utils';
import { IListSourceConfig } from 'xlsx-import/lib/config/IListSourceConfig';
import { ValueMapper } from 'xlsx-import/lib/abstracts/ValueMapper';

export function readFile(file: File, config: CustomConfig) {
  return new Promise<any[]>((res, rej) => {
    let fileReader = new FileReader();
    fileReader.onloadend = async (e) => {
      console.log(config.name, JSON.stringify(e));
      try {
        const wb = new Workbook();
        await wb.xlsx.load(fileReader.result as ArrayBuffer);
        const importer = new Importer(wb);
        const items = importer.getAllItems(config);
        const headers = items.shift();
        if (!equalsByValue(headers, config.headers)) {
          console.error(headers, config.headers);
          throw `Contenuto del file non valido, gli header non corrispondono`;
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

export type CustomConfig = {
  name: string;
  headers: any;
} & IListSourceConfig;

export function mapUnlessEq<T>(
  header: string,
  mapper: ValueMapper<T>
): ValueMapper<T | string> {
  return (v: string) => (v == header ? v : mapper(v));
}

export function customDateMapper(input: string) {
  const [day, month, year] = input.trim().split('/');
  var date = new Date(Number(year), Number(month)-1, Number(day));
  if (isNaN(date.getTime())) {
    date = new Date(input.trim());
    date.setHours(0,0,0,0);
    if (isNaN(date.getTime())) {
      console.warn(`cannot convert date ${input}`);
    }
  }
  return date;
}

export function customCellMapper(cell: string) {
  const sanitized = cell
    .trim()
    .replace(/[-\s/]/g, '')
    .replace(/^((00)|(\+))39/g, '');
  if (sanitized.match(/^\d{9,11}$/)) {
    return sanitized;
  } else {
    console.warn(`cannot sanitize cell ${cell}`);
    return '';
  }
}

export function trimMapper(str: string) {
  return str.trim();
}
