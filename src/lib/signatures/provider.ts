/**
 * Signature providers are interchangeable: drawn vs accredited certificate.
 * MSP validity of electronic 033 signatures is pending legal confirmation.
 */
export type TipoFirma =
  | "dibujada"
  | "electronica_simple"
  | "certificado_acreditado";

export type SignatureResult = {
  tipo: TipoFirma;
  referencia: string;
  imagenPath?: string;
  firmadoEn: Date;
};

export interface SignatureProvider {
  readonly name: string;
  readonly tipo: TipoFirma;
  sign(payload: {
    visitaId: string;
    userId: string;
    contentHash: string;
  }): Promise<SignatureResult>;
}

export class DrawnSignatureProvider implements SignatureProvider {
  readonly name = "drawn-stub";
  readonly tipo = "dibujada" as const;

  async sign(payload: {
    visitaId: string;
    userId: string;
    contentHash: string;
  }): Promise<SignatureResult> {
    return {
      tipo: "dibujada",
      referencia: `drawn:${payload.userId}:${payload.visitaId}:${payload.contentHash.slice(0, 12)}`,
      firmadoEn: new Date(),
    };
  }
}
