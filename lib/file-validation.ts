import { validateFile } from "./domain";
export function validateBytes(type: string, bytes: Uint8Array) {
  validateFile(type, bytes.length);
  const head = Buffer.from(bytes.slice(0, 16));
  const ok =
    type === "image/jpeg"
      ? head[0] === 255 && head[1] === 216 && head[2] === 255
      : type === "image/png"
        ? head
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : type === "image/webp"
          ? head.subarray(0, 4).toString() === "RIFF" &&
            head.subarray(8, 12).toString() === "WEBP"
          : type === "application/pdf"
            ? head.subarray(0, 5).toString() === "%PDF-"
            : !bytes.includes(0);
  if (!ok) throw Error("File signature does not match permitted content type");
}
