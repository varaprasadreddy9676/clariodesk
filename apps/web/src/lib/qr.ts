import QRCode from "qrcode";

export async function toQrImage(value: string): Promise<string> {
  if (value.startsWith("data:image/")) return value;
  if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 200) {
    return `data:image/png;base64,${value}`;
  }
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 7,
    color: {
      dark: "#14211f",
      light: "#ffffff",
    },
  });
}
