import { sheets } from "@googleapis/sheets";
import { JWT } from "google-auth-library";
import { consumesSession } from "./session-balance";
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

  const refreshedMeta = requests.length ? await withRetry(() => api.spreadsheets.get({ spreadsheetId })) : meta;
  const resizeRequests =
    refreshedMeta.data.sheets
      ?.filter((sheet) => sheet.properties?.title === CLIENTS_SHEET || sheet.properties?.title === CHECKINS_SHEET)
      .flatMap((sheet) => {
        const sheetId = sheet.properties?.sheetId;
        const title = sheet.properties?.title;
        if (sheetId === undefined || !title) return [];

        const minimumRows = title === CLIENTS_SHEET ? 120 : 2000;
        const rowCount = sheet.properties?.gridProperties?.rowCount ?? 0;
        const columnCount = sheet.properties?.gridProperties?.columnCount ?? 0;
        if (rowCount >= minimumRows && columnCount >= 7) return [];

        return [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: {
                  rowCount: Math.max(rowCount, minimumRows),
                  columnCount: Math.max(columnCount, 7)
                }
              },
              fields: "gridProperties(rowCount,columnCount)"
            }
          }
        ];
      }) ?? [];

  if (resizeRequests.length) {
    await withRetry(() => api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: resizeRequests } }));
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
      range: `${CLIENTS_SHEET}!A:G`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[client.clientId, client.name, client.qrUrl, client.status, client.createdAt, client.totalSessions, client.remainingSessions]]
      }
    })
  );
}

function clientApi() {
  return client();
}

async function sheetIdFor(title: string) {
  const api = clientApi();
  const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
  const meta = await withRetry(() => api.spreadsheets.get({ spreadsheetId }));
  const sheet = meta.data.sheets?.find((item) => item.properties?.title === title);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) throw new Error(`Missing sheet: ${title}`);
  return sheetId;
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

async function readCheckInRows() {
  await ensureSheetStructure();
  const api = clientApi();
  const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
  const response = await withRetry(() =>
    api.spreadsheets.values.get({ spreadsheetId, range: `${CHECKINS_SHEET}!A2:G` })
  );

  return (response.data.values ?? [])
    .map((row, index) => ({ row: row as string[], rowNumber: index + 2, checkIn: rowToCheckIn(row as string[]) }))
    .filter((entry): entry is { row: string[]; rowNumber: number; checkIn: CheckIn } => Boolean(entry.checkIn));
}

async function deleteCheckInRows(rowNumbers: number[]) {
  if (rowNumbers.length === 0) return;

  const api = clientApi();
  const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
  const sheetId = await sheetIdFor(CHECKINS_SHEET);

  await withRetry(() =>
    api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [...rowNumbers]
          .sort((a, b) => b - a)
          .map((rowNumber) => ({
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowNumber - 1,
                endIndex: rowNumber
              }
            }
          }))
      }
    })
  );
}

export async function recalculateClientSessions(clientId: string) {
  const targetClient = await getClient(clientId);
  if (!targetClient) return null;

  const rows = (await readCheckInRows())
    .filter((entry) => entry.checkIn.clientId === clientId)
    .sort((a, b) => {
      const timeDiff = new Date(a.checkIn.timestamp).getTime() - new Date(b.checkIn.timestamp).getTime();
      return timeDiff || a.rowNumber - b.rowNumber;
    });

  let remainingSessions = targetClient.totalSessions;
  const updates = rows.map((entry) => {
    if (consumesSession(entry.checkIn.type)) {
      remainingSessions = Math.max(remainingSessions - 1, 0);
    }
    return {
      range: `${CHECKINS_SHEET}!G${entry.rowNumber}`,
      values: [[remainingSessions]]
    };
  });

  if (updates.length) {
    const api = clientApi();
    const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
    await withRetry(() =>
      api.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: updates
        }
      })
    );
  }

  return updateClient(clientId, { remainingSessions });
}

export async function deleteCheckIn(match: Pick<CheckIn, "clientId" | "timestamp" | "type" | "manualOverride">) {
  const rows = await readCheckInRows();
  const target = rows.find(
    (entry) =>
      entry.checkIn.clientId === match.clientId &&
      entry.checkIn.timestamp === match.timestamp &&
      entry.checkIn.type === match.type &&
      entry.checkIn.manualOverride === match.manualOverride
  );

  if (!target) return null;

  await deleteCheckInRows([target.rowNumber]);
  await recalculateClientSessions(match.clientId);
  return target.checkIn;
}

export async function deleteClientCheckIns(clientId: string) {
  const rows = await readCheckInRows();
  const matches = rows.filter((entry) => entry.checkIn.clientId === clientId);
  await deleteCheckInRows(matches.map((entry) => entry.rowNumber));
  return matches.length;
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
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[checkIn.clientId, checkIn.name, checkIn.timestamp, checkIn.date, String(checkIn.manualOverride), checkIn.type, checkIn.sessionsRemaining]]
      }
    })
  );
}
