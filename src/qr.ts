import qrcode from "qrcode-generator";

export type Ecc = "L" | "M" | "Q" | "H";

/** Build a boolean module matrix (true = dark) for the given payload. */
export function makeMatrix(text: string, ecc: Ecc): boolean[][] {
  const qr = qrcode(0, ecc);
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    matrix.push(row);
  }
  return matrix;
}

/** Rough capacity check so we can show a friendly error instead of throwing. */
export function fits(text: string, ecc: Ecc): boolean {
  try {
    makeMatrix(text, ecc);
    return true;
  } catch {
    return false;
  }
}
