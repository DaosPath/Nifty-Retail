import { SignedXml } from "xml-crypto";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

export function signBoletaXml(unsignedXml: string, privateKeyPem: string, certificatePem: string): string {
  const doc = new DOMParser().parseFromString(unsignedXml, "text/xml");
  const invoiceNode = doc.documentElement;
  if (!invoiceNode) {
    throw new Error("XML de boleta inválido.");
  }

  const extContent = doc.getElementsByTagName("ext:ExtensionContent")[0]
    || doc.getElementsByTagNameNS(
      "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
      "ExtensionContent"
    )[0];

  if (!extContent) {
    throw new Error("No se encontró ExtensionContent para firmar el XML.");
  }

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
  });

  sig.addReference({
    xpath: "//*[local-name()='Invoice']",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
  });

  sig.computeSignature(unsignedXml, {
    location: { reference: "//*[local-name()='ExtensionContent']", action: "append" },
  });

  const signedFragment = sig.getSignatureXml();
  while (extContent.firstChild) {
    extContent.removeChild(extContent.firstChild);
  }

  const sigDoc = new DOMParser().parseFromString(`<wrapper>${signedFragment}</wrapper>`, "text/xml");
  const sigNode = sigDoc.documentElement?.firstChild;
  if (sigNode) {
    extContent.appendChild(sigNode.cloneNode(true));
  }

  const signatureEl = doc.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature")[0];
  if (signatureEl) {
    signatureEl.setAttribute("Id", "SignatureSP");
  }

  return new XMLSerializer().serializeToString(doc);
}