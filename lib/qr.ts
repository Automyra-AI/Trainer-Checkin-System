import QRCode from "qrcode";

export function baseUrl() {
  return (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function checkInUrl(clientId: string) {
  return `${baseUrl()}/checkin?clientId=${encodeURIComponent(clientId)}`;
}

export async function qrPngDataUrl(url: string) {
  return QRCode.toDataURL(url, {
    margin: 2,
    width: 1024,
    errorCorrectionLevel: "M",
    color: {
      dark: "#111827",
      light: "#FFFFFF"
    }
  });
}
