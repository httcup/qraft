declare module "qrcode-generator" {
  interface QRCodeModel {
    addData(data: string, mode?: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
    createSvgTag(opts?: Record<string, unknown>): string;
  }
  interface QRCodeFactory {
    (typeNumber: number, errorCorrectionLevel: "L" | "M" | "Q" | "H"): QRCodeModel;
    stringToBytes: (s: string) => number[];
    stringToBytesFuncs: Record<string, (s: string) => number[]>;
  }
  const qrcode: QRCodeFactory;
  export default qrcode;
}
