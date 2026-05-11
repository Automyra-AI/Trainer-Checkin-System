import type { CheckIn, Client } from "./types";

type CellValue = string | number | boolean | null | undefined;

type Worksheet = {
  name: string;
  rows: CellValue[][];
};

const INVALID_SHEET_NAME_CHARS = /[\[\]:*?/\\]/g;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
}

function sheetName(baseName: string, usedNames: Set<string>) {
  const fallback = "Client";
  const cleaned = (baseName || fallback).replace(INVALID_SHEET_NAME_CHARS, " ").trim() || fallback;
  let candidate = cleaned.slice(0, 31);
  let suffix = 1;

  while (usedNames.has(candidate.toLowerCase())) {
    suffix += 1;
    const label = ` ${suffix}`;
    candidate = `${cleaned.slice(0, 31 - label.length)}${label}`;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function entryTypeLabel(type: CheckIn["type"]) {
  const labels: Record<CheckIn["type"], string> = {
    qr_checkin: "QR check-in",
    manual_session: "Completed session",
    late_cancel: "Late cancel",
    no_show: "No show"
  };

  return labels[type];
}

function formatDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function worksheetXml(rows: CellValue[][]) {
  const xmlRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${columnName(columnIndex)}${rowNumber}`;

          if (value === null || value === undefined || value === "") {
            return `<c r="${reference}"/>`;
          }

          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${reference}"><v>${value}</v></c>`;
          }

          return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="22" customWidth="1"/>
    <col min="2" max="2" width="28" customWidth="1"/>
    <col min="3" max="7" width="20" customWidth="1"/>
  </cols>
  <sheetData>${xmlRows}</sheetData>
</worksheet>`;
}

function workbookXml(sheets: Worksheet[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets
      .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join("")}
  </sheets>
</workbook>`;
}

function workbookRelationshipsXml(sheets: Worksheet[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("")}
</Relationships>`;
}

function rootRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function contentTypesXml(sheets: Worksheet[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets
    .map(
      (_sheet, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("")}
</Types>`;
}

const crcTable = Array.from({ length: 256 }, (_value, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files: Array<{ name: string; content: string }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.content, "utf8");
    const checksum = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function clientRows(client: Client, history: CheckIn[]) {
  return [
    ["Client", client.name],
    ["Client ID", client.clientId],
    ["Status", client.status],
    ["Created At", formatDateTime(client.createdAt)],
    ["Total Sessions", client.totalSessions],
    ["Remaining Sessions", client.remainingSessions],
    [],
    ["Check-in History"],
    ["Date", "Time", "Type", "Manual Override", "Sessions Remaining", "Timestamp"],
    ...history.map((entry) => {
      const timestamp = new Date(entry.timestamp);
      const validTimestamp = !Number.isNaN(timestamp.getTime());
      return [
        validTimestamp ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(timestamp) : entry.date,
        validTimestamp ? new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(timestamp) : "",
        entryTypeLabel(entry.type),
        entry.manualOverride ? "Yes" : "No",
        entry.sessionsRemaining,
        entry.timestamp
      ];
    })
  ];
}

function buildWorksheets(clients: Client[], checkIns: CheckIn[]): Worksheet[] {
  const usedNames = new Set<string>();
  const activeClients = clients.filter((client) => client.status !== "deleted");

  if (activeClients.length === 0) {
    return [{ name: "No Clients", rows: [["No clients found"]] }];
  }

  return activeClients.map((client) => ({
    name: sheetName(client.name, usedNames),
    rows: clientRows(
      client,
      checkIns.filter((entry) => entry.clientId === client.clientId)
    )
  }));
}

export function createClientHistoryWorkbook(clients: Client[], checkIns: CheckIn[]) {
  const worksheets = buildWorksheets(clients, checkIns);
  const files = [
    { name: "[Content_Types].xml", content: contentTypesXml(worksheets) },
    { name: "_rels/.rels", content: rootRelationshipsXml() },
    { name: "xl/workbook.xml", content: workbookXml(worksheets) },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRelationshipsXml(worksheets) },
    ...worksheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: worksheetXml(sheet.rows)
    }))
  ];

  return createZip(files);
}
