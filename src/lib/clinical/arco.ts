export type EstadoSolicitudArco =
  | "solicitada"
  | "aprobada_admin"
  | "rechazada"
  | "ejecutada";

export type TipoSolicitudArco = "exportacion" | "eliminacion";

/** Retention hold: only block when retencion_hasta is strictly in the future. */
export function isRetencionVigente(
  retencionHasta: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!retencionHasta) return false;
  return retencionHasta.getTime() > now.getTime();
}

export function canExecuteEliminacion(input: {
  estado: EstadoSolicitudArco;
  tipo: TipoSolicitudArco;
  retencionHasta: Date | null | undefined;
  now?: Date;
}): { ok: true } | { ok: false; reason: string } {
  if (input.tipo !== "eliminacion") {
    return { ok: false, reason: "La solicitud no es de eliminación" };
  }
  if (input.estado !== "aprobada_admin") {
    return {
      ok: false,
      reason: "La eliminación requiere estado aprobada_admin",
    };
  }
  if (isRetencionVigente(input.retencionHasta, input.now ?? new Date())) {
    return {
      ok: false,
      reason:
        "Retención vigente (retencion_hasta en el futuro). No se elimina hasta que expire o lo confirme la política legal.",
    };
  }
  return { ok: true };
}

export function canExecuteExportacion(input: {
  estado: EstadoSolicitudArco;
  tipo: TipoSolicitudArco;
}): { ok: true } | { ok: false; reason: string } {
  if (input.tipo !== "exportacion") {
    return { ok: false, reason: "La solicitud no es de exportación" };
  }
  if (input.estado !== "aprobada_admin") {
    return {
      ok: false,
      reason: "La exportación requiere estado aprobada_admin",
    };
  }
  return { ok: true };
}

export function nextEstadoTrasAprobar(
  estado: EstadoSolicitudArco,
): EstadoSolicitudArco | null {
  return estado === "solicitada" ? "aprobada_admin" : null;
}

export function nextEstadoTrasRechazar(
  estado: EstadoSolicitudArco,
): EstadoSolicitudArco | null {
  return estado === "solicitada" ? "rechazada" : null;
}

/** Anonymized identity after ARCO eliminación — keeps FK + unique doc index. */
export function anonymizedPacienteFields(solicitudId: string): {
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  direccion: null;
  telefono: null;
  email: null;
  contactoEmergenciaNombre: null;
  contactoEmergenciaTelefono: null;
  numeroArchivo: null;
} {
  const short = solicitudId.replace(/^arco_/, "").slice(0, 12);
  return {
    nombres: "ELIMINADO",
    apellidos: "ARCO",
    numeroDocumento: `ARCO-${short}`,
    direccion: null,
    telefono: null,
    email: null,
    contactoEmergenciaNombre: null,
    contactoEmergenciaTelefono: null,
    numeroArchivo: null,
  };
}
