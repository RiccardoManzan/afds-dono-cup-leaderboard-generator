export function equalsByValue(obj1: any, obj2: any): boolean {
  const obj1Keys = Object.keys(obj1);
  const obj2Keys = Object.keys(obj2);

  return (
    obj1Keys.length === obj2Keys.length &&
    obj1Keys.every((key) => obj1[key] == obj2[key])
  );
}
export function normalizeName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\-']/g, "")
    .toUpperCase()
}
