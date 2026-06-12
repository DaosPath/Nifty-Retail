export type SunatEnvironment = "beta" | "production";

export interface SunatConfig {
  enabled: boolean;
  environment: SunatEnvironment;
  /** Usuario SOL (sin RUC delante) */
  solUsuario: string;
  solClave: string;
  /** Ruta absoluta al certificado .pfx */
  certPath: string;
  certPassword: string;
  /** Razón social registrada en SUNAT */
  razonSocial?: string;
}

export interface SunatEmissionInput {
  sale: {
    documentNumber: string;
    timestamp: string;
    items: Array<{ code: string; name: string; price: number; quantity: number }>;
    subtotal: number;
    discount: number;
    total: number;
    gravada: number;
    igv: number;
    customerDni?: string;
    customerName?: string;
  };
  store: {
    ruc: string;
    businessName: string;
    address: string;
    boletaSeries: string;
  };
}

export interface SunatEmissionResult {
  success: boolean;
  cdrCode?: string;
  cdrDescription?: string;
  hash?: string;
  qrPayload?: string;
  pendingSummary?: boolean;
  message: string;
  rawResponse?: string;
}

export const SUNAT_BILL_SERVICE_URL: Record<SunatEnvironment, string> = {
  beta: "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService",
  production: "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService",
};