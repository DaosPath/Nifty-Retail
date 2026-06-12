import { SUNAT_BILL_SERVICE_URL, type SunatEnvironment } from "../../types/sunat";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSendBillEnvelope(
  ruc: string,
  solUsuario: string,
  solClave: string,
  zipFileName: string,
  zipBase64: string
): string {
  const wsUser = `${ruc}${solUsuario}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml(wsUser)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(solClave)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:sendBill>
      <fileName>${escapeXml(zipFileName)}.zip</fileName>
      <contentFile>${zipBase64}</contentFile>
    </ser:sendBill>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export async function sendBillToSunat(
  environment: SunatEnvironment,
  envelope: string
): Promise<string> {
  const url = SUNAT_BILL_SERVICE_URL[environment];
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: envelope,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SUNAT respondió HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  return text;
}

export function extractApplicationResponse(soapXml: string): string | null {
  const match = soapXml.match(/<applicationResponse>([^<]+)<\/applicationResponse>/i)
    || soapXml.match(/<applicationResponse[^>]*>([\s\S]*?)<\/applicationResponse>/i);
  return match?.[1]?.trim() || null;
}