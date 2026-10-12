import { PDFDocument, StandardFonts } from "pdf-lib";
import { zipSync, strToU8 } from "fflate";

/** PDF de menu : chaque bloc = liste de lignes [texte gauche, prix aligné à droite ?]. */
export async function makeMenuPdf(columns: [string, string?][][]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const colWidth = 595 / columns.length;
  columns.forEach((lines, c) => {
    let y = 780;
    for (const [text, price] of lines) {
      const x0 = 40 + c * colWidth;
      if (text) page.drawText(text, { x: x0, y, size: 11, font });
      if (price) page.drawText(price, { x: x0 + colWidth - 110, y, size: 11, font });
      y -= 18;
    }
  });
  return Buffer.from(await pdf.save());
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Fichier .xlsx minimal (chaînes en ligne, nombres) pour les tests. */
export function makeXlsx(sheets: { name: string; rows: (string | number)[][] }[]): Buffer {
  const files: Record<string, Uint8Array> = {};
  files["[Content_Types].xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join("")}</Types>`,
  );
  files["_rels/.rels"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  files["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
      .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets></workbook>`,
  );
  files["xl/_rels/workbook.xml.rels"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("")}</Relationships>`,
  );
  sheets.forEach((s, i) => {
    const col = (n: number) => String.fromCharCode(65 + n);
    const rows = s.rows
      .map(
        (r, ri) =>
          `<row r="${ri + 1}">${r
            .map((v, ci) =>
              typeof v === "number"
                ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>`
                : `<c r="${col(ci)}${ri + 1}" t="inlineStr"><is><t>${escapeXml(v)}</t></is></c>`,
            )
            .join("")}</row>`,
      )
      .join("");
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
    );
  });
  return Buffer.from(zipSync(files));
}

/** GLB minimal valide : un carré de `sizeM` mètres posé au sol (Y = 0). */
export function makeGlb(sizeM = 0.26, heightM = 0.05): Buffer {
  const h = sizeM / 2;
  const positions = new Float32Array([-h, 0, -h, h, 0, -h, h, heightM, h, -h, heightM, h]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const bin = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(indices.buffer)]);
  const json = {
    asset: { version: "2.0", generator: "test" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: "VEC3", min: [-h, 0, -h], max: [h, heightM, h] },
      { bufferView: 1, componentType: 5123, count: 6, type: "SCALAR" },
    ],
  };
  const jsonBuf = Buffer.from(JSON.stringify(json));
  const jsonPadded = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);
  const ch = (len: number, type: number) => {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(len, 0);
    b.writeUInt32LE(type, 4);
    return b;
  };
  return Buffer.concat([header, ch(jsonPadded.length, 0x4e4f534a), jsonPadded, ch(binPadded.length, 0x004e4942), binPadded]);
}

/** USDZ minimal : archive ZIP non compressée dont le premier fichier est une scène .usda. */
export function makeUsdz(): Buffer {
  const usda = `#usda 1.0\n(\n    defaultPrim = "Plat"\n    metersPerUnit = 1\n    upAxis = "Y"\n)\n\ndef Xform "Plat"\n{\n}\n`;
  return Buffer.from(zipSync({ "plat.usda": [strToU8(usda), { level: 0 }] }));
}

export async function makeImage(color = "#c0392b", width = 1200, height = 900): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width, height, channels: 3, background: color } }).jpeg({ quality: 85 }).toBuffer();
}
