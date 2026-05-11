export function nowIso() {
  return new Date().toISOString();
}

export function dateKey(input = new Date()) {
  return input.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function weekStartKey(input = new Date()) {
  const localDate = new Date(`${dateKey(input)}T00:00:00`);
  const day = localDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  localDate.setDate(localDate.getDate() + diff);
  return dateKey(localDate);
}

export function monthStartKey(input = new Date()) {
  const [year, month] = dateKey(input).split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function displayTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York"
  }).format(new Date(iso));
}
