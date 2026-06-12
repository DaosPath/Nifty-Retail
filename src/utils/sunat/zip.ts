import JSZip from "jszip";

export async function zipXmlFile(fileName: string, xmlContent: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(`${fileName}.xml`, xmlContent);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function base64ToUint8(base64: string): Promise<Uint8Array> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function unzipFirstXml(zipBytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(zipBytes);
  const names = Object.keys(zip.files).filter((n) => /\.xml$/i.test(n) && !zip.files[n].dir);
  if (names.length === 0) {
    throw new Error("El ZIP de respuesta SUNAT no contiene XML.");
  }
  return zip.file(names[0])!.async("string");
}