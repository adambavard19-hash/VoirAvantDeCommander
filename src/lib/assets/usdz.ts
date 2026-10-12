/**
 * Validation structurelle d'un fichier USDZ (archive ZIP non compressée dont le
 * premier fichier est la scène USD), selon les exigences d'AR Quick Look (iOS).
 * On ne mesure pas la géométrie (format binaire USDC) : l'échelle du USDZ doit
 * être vérifiée sur iPhone ; l'interface le signale clairement.
 */
export type UsdzAnalysis = {
  valid: boolean;
  rootFile: string | null;
  entries: number;
  textures: number;
  /** metersPerUnit déclaré (uniquement lisible si la scène racine est au format texte .usda). */
  metersPerUnit: number | null;
  upAxis: string | null;
  sizeBytes: number;
  errors: string[];
  warnings: string[];
};

const LOCAL_HEADER = 0x04034b50;

export function analyzeUsdz(buffer: Buffer): UsdzAnalysis {
  const result: UsdzAnalysis = {
    valid: false,
    rootFile: null,
    entries: 0,
    textures: 0,
    metersPerUnit: null,
    upAxis: null,
    sizeBytes: buffer.length,
    errors: [],
    warnings: [],
  };
  if (buffer.length < 30 || buffer.readUInt32LE(0) !== LOCAL_HEADER) {
    result.errors.push("Ce fichier n'est pas un USDZ valide (archive ZIP attendue).");
    return result;
  }
  let offset = 0;
  let compressed = 0;
  let misaligned = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === LOCAL_HEADER) {
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;
    if (flags & 0x08) {
      result.errors.push("Archive avec descripteurs de données : non conforme USDZ.");
      return result;
    }
    if (dataStart + compSize > buffer.length) {
      result.errors.push("Archive USDZ tronquée (téléversement incomplet ?).");
      return result;
    }
    if (result.entries === 0) {
      result.rootFile = name;
      if (!/\.(usdc|usda|usd)$/i.test(name)) result.errors.push(`Le premier fichier de l'archive doit être une scène USD (trouvé : ${name}).`);
      if (/\.usda$/i.test(name) && method === 0) {
        const text = buffer.toString("utf8", dataStart, Math.min(dataStart + compSize, dataStart + 64 * 1024));
        const mpu = text.match(/metersPerUnit\s*=\s*([0-9.eE+-]+)/);
        if (mpu) result.metersPerUnit = Number(mpu[1]);
        const up = text.match(/upAxis\s*=\s*"([XYZ])"/);
        if (up) result.upAxis = up[1]!;
      }
    }
    if (/\.(png|jpe?g|exr|avif)$/i.test(name)) result.textures++;
    if (method !== 0) compressed++;
    if (dataStart % 64 !== 0) misaligned++;
    result.entries++;
    offset = dataStart + compSize;
  }
  if (result.entries === 0) result.errors.push("Archive USDZ vide.");
  if (compressed) result.errors.push(`${compressed} fichier(s) compressé(s) dans l'archive : AR Quick Look exige une archive non compressée.`);
  if (misaligned) result.warnings.push(`${misaligned} fichier(s) non alignés sur 64 octets : réexportez avec Reality Converter ou usdzip.`);
  const mb = buffer.length / 1024 / 1024;
  if (mb > 25) result.warnings.push(`Fichier très lourd (${mb.toFixed(1)} Mo) : visez moins de 10 Mo.`);
  else if (mb > 10) result.warnings.push(`Fichier lourd (${mb.toFixed(1)} Mo) : visez moins de 10 Mo pour un chargement rapide.`);
  if (result.metersPerUnit !== null && result.metersPerUnit !== 0.01 && result.metersPerUnit !== 1)
    result.warnings.push(`Unité déclarée inhabituelle (metersPerUnit = ${result.metersPerUnit}).`);
  result.valid = result.errors.length === 0;
  return result;
}
