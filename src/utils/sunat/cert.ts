import { invoke } from "@tauri-apps/api/core";
import forge from "node-forge";

export interface LoadedCertificate {
  privateKeyPem: string;
  certificatePem: string;
}

export async function loadPfxCertificate(
  certPath: string,
  password: string
): Promise<LoadedCertificate> {
  const bytes = await invoke<number[]>("read_binary_file", { path: certPath });
  const buffer = forge.util.createBuffer(new Uint8Array(bytes));
  const p12Asn1 = forge.asn1.fromDer(buffer.getBytes());
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    || keyBags[forge.pki.oids.keyBag]?.[0];
  const certBag = certBags[forge.pki.oids.certBag]?.[0];

  if (!keyBag?.key || !certBag?.cert) {
    throw new Error("El certificado .pfx no contiene llave privada o certificado válido.");
  }

  return {
    privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
    certificatePem: forge.pki.certificateToPem(certBag.cert),
  };
}