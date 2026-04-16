const LAO_MONTHS_FULL = [
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


type LaoDateStyle = "short" | "medium";
type LaoTimeStyle = "short" | "none";

interface FormatLaoDateOptions {
  dateStyle?: LaoDateStyle;
  timeStyle?: LaoTimeStyle;
}

function toLaoDigits(value: number | string): string {
  return String(value);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatLaoDateTime(
  value?: string | Date | null,
  options: FormatLaoDateOptions = {},
): string {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const dateStyle = options.dateStyle ?? "medium";
  const timeStyle = options.timeStyle ?? "short";

  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  const formattedDate =
    dateStyle === "short"
      ? `${toLaoDigits(pad(day))}/${toLaoDigits(pad(month + 1))}/${toLaoDigits(year)}`
      : `${toLaoDigits(day)} ${LAO_MONTHS_FULL[month]} ${toLaoDigits(year)}`;

  if (timeStyle === "none") {
    return formattedDate;
  }

  return `${formattedDate}, ${toLaoDigits(hours)}:${toLaoDigits(minutes)}`;
}
