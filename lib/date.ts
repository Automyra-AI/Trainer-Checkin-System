export function nowIso() {
  return new Date().toISOString();
}

export function dateKey(input = new Date()) {
  return input.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function displayTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York"
  }).format(new Date(iso));
}
