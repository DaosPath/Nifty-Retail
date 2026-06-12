import type { SunatConfig, SunatEmissionInput, SunatEmissionResult } from "../../types/sunat";
import { buildSunatQrPayload } from "../documents";
import { boletaZipFileName, buildBoletaXml } from "./boletaXml";
import { loadPfxCertificate } from "./cert";
import { parseCdrFromSoap } from "./cdr";
import { signBoletaXml } from "./sign";
import { buildSendBillEnvelope, extractApplicationResponse, sendBillToSunat } from "./soap";
import { uint8ToBase64, zipXmlFile } from "./zip";

const BOLETA_SUMMARY_THRESHOLD = 700;

export async function testSunatConnection(config: SunatConfig, _ruc: string): Promise<SunatEmissionResult> {
  if (!config.solUsuario || !config.solClave) {
    return { success: false, message: "Complete usuario y clave SOL." };
  }
  if (!config.certPath) {
    return { success: false, message: "Indique la ruta del certificado .pfx." };
  }

  try {
    await loadPfxCertificate(config.certPath, config.certPassword);
    return {
      success: true,
      message: `Certificado cargado. Modo ${config.environment === "beta" ? "pruebas (beta)" : "producción"}. Listo para emitir boletas.`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Error al validar certificado SUNAT.",
    };
  }
}

export async function emitSunatBoleta(
  config: SunatConfig,
  input: SunatEmissionInput
): Promise<SunatEmissionResult> {
  if (!config.enabled) {
    return { success: false, message: "SUNAT deshabilitado en configuración." };
  }

  if (input.sale.total < BOLETA_SUMMARY_THRESHOLD) {
    return {
      success: true,
      pendingSummary: true,
      message:
        "Boleta registrada localmente. Ventas menores a S/ 700 se envían en el resumen diario (configúralo al cierre del día en SUNAT).",
      qrPayload: buildSunatQrPayload(input.store.ruc, {
        id: "pending",
        timestamp: input.sale.timestamp,
        items: input.sale.items,
        subtotal: input.sale.subtotal,
        discount: input.sale.discount,
        total: input.sale.total,
        paymentMethod: "Efectivo",
        documentType: "boleta",
        documentNumber: input.sale.documentNumber,
        customerDni: input.sale.customerDni,
        customerName: input.sale.customerName,
        gravada: input.sale.gravada,
        igv: input.sale.igv,
      }),
    };
  }

  try {
    const { privateKeyPem, certificatePem } = await loadPfxCertificate(
      config.certPath,
      config.certPassword
    );

    const unsignedXml = buildBoletaXml(input);
    const signedXml = signBoletaXml(unsignedXml, privateKeyPem, certificatePem);
    const baseName = boletaZipFileName(input.store.ruc, input.sale.documentNumber);
    const zipBytes = await zipXmlFile(baseName, signedXml);
    const zipBase64 = uint8ToBase64(zipBytes);

    const envelope = buildSendBillEnvelope(
      input.store.ruc,
      config.solUsuario,
      config.solClave,
      baseName,
      zipBase64
    );

    const soapResponse = await sendBillToSunat(config.environment, envelope);
    const appResponse = extractApplicationResponse(soapResponse);

    if (!appResponse) {
      return {
        success: false,
        message: "SUNAT no devolvió CDR. Revise credenciales SOL y certificado.",
        rawResponse: soapResponse.slice(0, 500),
      };
    }

    const cdr = await parseCdrFromSoap(soapResponse);
    const accepted = cdr.code === "0";

    const saleForQr = {
      id: "sunat",
      timestamp: input.sale.timestamp,
      items: input.sale.items,
      subtotal: input.sale.subtotal,
      discount: input.sale.discount,
      total: input.sale.total,
      paymentMethod: "Efectivo",
      documentType: "boleta" as const,
      documentNumber: input.sale.documentNumber,
      customerDni: input.sale.customerDni,
      customerName: input.sale.customerName,
      gravada: input.sale.gravada,
      igv: input.sale.igv,
      sunatHash: cdr.hash,
    };

    let qrPayload = buildSunatQrPayload(input.store.ruc, saleForQr);
    if (cdr.hash) {
      qrPayload = `${qrPayload}|${cdr.hash}`;
    }

    return {
      success: accepted,
      cdrCode: cdr.code,
      cdrDescription: cdr.description,
      hash: cdr.hash,
      qrPayload,
      message: accepted
        ? `Boleta aceptada por SUNAT: ${cdr.description}`
        : `SUNAT rechazó la boleta (${cdr.code}): ${cdr.description}`,
      rawResponse: soapResponse.slice(0, 500),
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Error al emitir boleta en SUNAT.",
    };
  }
}