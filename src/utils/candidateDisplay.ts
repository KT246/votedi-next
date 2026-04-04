const LAO_MONTHS = [
  "ມັງກອນ",
  "ກຸມພາ",
  "ມີນາ",
  "ເມສາ",
  "ພຶດສະພາ",
  "ມິຖຸນາ",
  "ກໍລະກົດ",
  "ສິງຫາ",
  "ກັນຍາ",
  "ຕຸລາ",
  "ພະຈິກ",
  "ທັນວາ",
];

export function formatLaoDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = new Intl.NumberFormat("lo-LA", { useGrouping: false }).format(date.getDate());
  const year = String(date.getFullYear());
  const month = LAO_MONTHS[date.getMonth()] || "";
  return `${day} ${month} ${year}`.trim();
}

export function cleanCandidateText(value?: string): string {
  return String(value || "")
    .replace(/ປະທານ/g, "")
    .replace(/ຈົບປະລີນຍາໂທ/g, "")
    .replace(/\s*;\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
