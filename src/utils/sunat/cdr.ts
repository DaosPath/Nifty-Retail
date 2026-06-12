import { base64ToUint8, unzipFirstXml } from "./zip";

export interface ParsedCdr {
  code: string;
  description: string;
  hash?: string;
}

export async function parseCdrFromSoap(soapResponse: string): Promise<ParsedCdr> {
  const b64Match = soapResponse.match(/<applicationResponse>([^<]+)<\/applicationResponse>/i);
  if (!b64Match?.[1]) {
    const fault = soapResponse.match(/<faultstring>([^<]+)<\/faultstring>/i);
    throw new Error(fault?.[1] || "SUNAT no devolvió CDR en la respuesta.");
  }

  const zipBytes = await base64ToUint8(b64Match[1].trim());
  let xml = await unzipFirstXml(zipBytes);

  if (xml.trim().startsWith("PK")) {
    const innerZip = new TextEncoder().encode(xml);
    xml = await unzipFirstXml(innerZip);
  }

  const codeMatch = xml.match(/<cbc:ResponseCode>([^<]+)<\/cbc:ResponseCode>/i)
    || xml.match(/ResponseCode>(\d+)</i);
  const descMatch = xml.match(/<cbc:Description>([^<]+)<\/cbc:Description>/i)
    || xml.match(/Description>([^<]+)</i);

  const digestMatch = xml.match(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/i);

  return {
    code: codeMatch?.[1]?.trim() || "unknown",
    description: descMatch?.[1]?.trim() || "Sin descripción",
    hash: digestMatch?.[1]?.trim(),
  };
}