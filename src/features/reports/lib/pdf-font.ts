import type { jsPDF } from "jspdf";

const PDF_FONT_FILE = "NotoSans-Variable.ttf";
const PDF_FONT_FAMILY = "NotoSansUnicode";
const PDF_FONT_URL = "/fonts/NotoSans-Variable.ttf";

let fontBase64Promise: Promise<string> | null = null;

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
};

const loadPdfFontBase64 = async () => {
  if (fontBase64Promise) return fontBase64Promise;

  fontBase64Promise = fetch(PDF_FONT_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`PDF font yüklenemedi (${response.status})`);
      }

      return arrayBufferToBase64(await response.arrayBuffer());
    })
    .catch((error) => {
      fontBase64Promise = null;
      throw error;
    });

  return fontBase64Promise;
};

export const ensurePdfUnicodeFont = async (doc: jsPDF) => {
  const fontList = doc.getFontList() as Record<string, string[]>;

  if (!fontList[PDF_FONT_FAMILY]) {
    const base64 = await loadPdfFontBase64();
    doc.addFileToVFS(PDF_FONT_FILE, base64);
    doc.addFont(PDF_FONT_FILE, PDF_FONT_FAMILY, "normal");
    doc.addFont(PDF_FONT_FILE, PDF_FONT_FAMILY, "bold");
  }

  doc.setFont(PDF_FONT_FAMILY, "normal");
};
