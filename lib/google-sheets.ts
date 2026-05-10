import { sheets } from "@googleapis/sheets";
import { JWT } from "google-auth-library";
import type { CheckIn, CheckInType, Client, ClientStatus } from "./types";

const CLIENTS_SHEET = "Clients";
const CHECKINS_SHEET = "CheckIns";
const CLIENT_HEADERS = ["ClientId", "Name", "QrUrl", "Status", "CreatedAt", "TotalSessions", "RemainingSessions"];
const CHECKIN_HEADERS = ["ClientId", "Name", "Timestamp", "Date", "ManualOverride", "Type", "SessionsRemaining"];

function numberCell(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function checkInType(row: string[]): CheckInType {
  const value = row[5] as CheckInType | undefined;
  if (value === "qr_checkin" || value === "manual_session" || value === "late_cancel" || value === "no_show") {
    return value;
  }

  return row[4] === "true" ? "manual_session" : "qr_checkin";
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function privateKey() {
  return requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function client() {
  const auth = new JWT({
    email: requiredEnv("GOOGLE_CLIENT_EMAIL"),
    key: privateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return sheets({ version: "v4", auth });
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 350));
      }
    }
  }
  console.error("Google Sheets operation failed", lastError);
  throw lastError;
}

function rowToClient(row: string[]): Client | null {
  if (!row?.[0]) return null;
  return {
    clientId: row[0],
    name: row[1] ?? "",
    qrUrl: row[2] ?? "",
    status: (row[3] as ClientStatus) || "active",
    createdAt: row[4] ?? "",
    totalSessions: numberCell(row[5]),
    remainingSessions: numberCell(row[6])
  };
}

function rowToCheckIn(row: string[]): CheckIn | null {
  if (!row?.[0]) return null;
  return {
    clientId: row[0],
    name: row[1] ?? "",
    timestamp: row[2] ?? "",
    date: row[3] ?? "",
    manualOverride: row[4] === "true",
    type: checkInType(row),
    sessionsRemaining: numberCell(row[6])
  };
}

export async function ensureSheetStructure() {
  const api = client();
  const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");

  const meta = await withRetry(() => api.spreadsheets.get({ spreadsheetId }));
  const titles = new Set(meta.data.sheets?.map((sheet) => sheet.properties?.title));
  const requests = [CLIENTS_SHEET, CHECKINS_SHEET]
    .filter((title) => !titles.has(title))
    .map((title) => ({ addSheet: { properties: { title } } }));

  if (requests.length) {
    await withRetry(() => api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } }));
  }

  await withRetry(() =>
    api.spreadsheets.values.update({
      spreadsheetId,
      range: `${CLIENTS_SHEET}!A1:G1`,
      valueInputOption: "RAW",
      requestBody: { values: [CLIENT_HEADERS] }
    })
  );

  await withRetry(() =>
    api.spreadsheets.values.update({
      spreadsheetId,
      range: `${CHECKINS_SHEET}!A1:G1`,
      valueInputOption: "RAW",
      requestBody: { values: [CHECKIN_HEADERS] }
    })
  );
}

export async function getClients(includeDeleted = false) {
  await ensureSheetStructure();
  const api = client();
  const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
  const response = await withRetry(() =>
    api.spreadsheets.values.get({ spreadsheetId, range: `${CLIENTS_SHEET}!A2:G` })
  );
  const clients = (response.data.values ?? []).map(rowToClient).filter(Boolean) as Client[];
  return includeDeleted ? clients : clients.filter((client) => client.status !== "deleted");
}

export async function getClient(clientId: string) {
  const clients = await getClients(true);
  return clients.find((client) => client.clientId === clientId) ?? null;
}

export async function addClient(client: Client) {
  await ensureSheetStructure();
  const api = clientApi();
  const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
  await withRetry(() =>
    api.spreadsheets.values.append({
      spreadsheetId,
      range: `${CLIENTS_SHEET}!A:E`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[client.clientId, client.name, client.qrUrl, client.status, client.createdAt, client.totalSessions, client.remainingSessions]]
      }
    })
  );
}

function clientApi() {
  return client();
}

export async function updateClient(clientId: string, updates: Partial<Pick<Client, "name" | "status" | "qrUrl" | "totalSessions" | "remainingSessions">>) {
  const clients = await getClients(true);
  const rowIndex = clients.findIndex((client) => client.clientId === clientId);
  if (rowIndex === -1) return null;

  const next = { ...clients[rowIndex], ...updates };
  const api = clientApi();
  const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
  const sheetRow = rowIndex + 2;

  await withRetry(() =>
    api.spreadsheets.values.update({
      spreadsheetId,
      range: `${CLIENTS_SHEET}!A${sheetRow}:G${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[next.clientId, next.name, next.qrUrl, next.status, next.createdAt, next.totalSessions, next.remainingSessions]]
      }
    })
  );

  return next;
}

export async function getCheckIns() {
  await ensureSheetStructure();
  const api = clientApi();
  const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
  const response = await withRetry(() =>
    api.spreadsheets.values.get({ spreadsheetId, range: `${CHECKINS_SHEET}!A2:G` })
  );
  return ((response.data.values ?? []).map(rowToCheckIn).filter(Boolean) as CheckIn[]).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function appendCheckIn(checkIn: CheckIn) {
  await ensureSheetStructure();
  const api = clientApi();
  const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
  await withRetry(() =>
    api.spreadsheets.values.append({
      spreadsheetId,
      range: `${CHECKINS_SHEET}!A:G`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[checkIn.clientId, checkIn.name, checkIn.timestamp, checkIn.date, String(checkIn.manualOverride), checkIn.type, checkIn.sessionsRemaining]]
      }
    })
  );
}
