"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createPacienteAction,
  updatePacienteAction,
} from "@/app/app/[clinicaId]/pacientes/actions";
import {
  pacienteCreateSchema,
  type PacienteInput,
} from "@/lib/validation/paciente";
import { useState, useTransition } from "react";

type Props = {
  clinicaId: string;
  mode: "create" | "edit";
  pacienteId?: string;
  defaultValues?: Partial<PacienteInput>;
};

export function PacienteForm({
  clinicaId,
  mode,
  pacienteId,
  defaultValues,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<PacienteInput>({
    resolver: zodResolver(pacienteCreateSchema),
    defaultValues: {
      tipoDocumento: "cedula",
      numeroDocumento: "",
      nombres: "",
      apellidos: "",
      fechaNacimiento: "",
      sexo: "no_especificado",
      direccion: "",
      telefono: "",
      email: "",
      contactoEmergenciaNombre: "",
      contactoEmergenciaTelefono: "",
      numeroArchivo: "",
      ...defaultValues,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createPacienteAction(clinicaId, values)
          : await updatePacienteAction(clinicaId, pacienteId!, values);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      router.push(`/app/${clinicaId}/pacientes/${result.data.id}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="tipoDocumento">Tipo de documento</Label>
          <Select id="tipoDocumento" {...form.register("tipoDocumento")}>
            <option value="cedula">Cédula</option>
            <option value="pasaporte">Pasaporte</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="numeroDocumento">Número</Label>
          <Input id="numeroDocumento" {...form.register("numeroDocumento")} />
          {form.formState.errors.numeroDocumento ? (
            <p className="text-destructive mt-1 text-sm">
              {form.formState.errors.numeroDocumento.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="nombres">Nombres</Label>
          <Input id="nombres" {...form.register("nombres")} />
        </div>
        <div>
          <Label htmlFor="apellidos">Apellidos</Label>
          <Input id="apellidos" {...form.register("apellidos")} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
          <Input
            id="fechaNacimiento"
            type="date"
            {...form.register("fechaNacimiento")}
          />
        </div>
        <div>
          <Label htmlFor="sexo">Sexo</Label>
          <Select id="sexo" {...form.register("sexo")}>
            <option value="femenino">Femenino</option>
            <option value="masculino">Masculino</option>
            <option value="otro">Otro</option>
            <option value="no_especificado">No especificado</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="direccion">Dirección</Label>
        <Input id="direccion" {...form.register("direccion")} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" {...form.register("telefono")} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...form.register("email")} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="contactoEmergenciaNombre">Contacto emergencia</Label>
          <Input
            id="contactoEmergenciaNombre"
            {...form.register("contactoEmergenciaNombre")}
          />
        </div>
        <div>
          <Label htmlFor="contactoEmergenciaTelefono">Tel. emergencia</Label>
          <Input
            id="contactoEmergenciaTelefono"
            {...form.register("contactoEmergenciaTelefono")}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="numeroArchivo">Nº archivo</Label>
        <Input id="numeroArchivo" {...form.register("numeroArchivo")} />
      </div>

      {error ? <p className="text-destructive text-base">{error}</p> : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit" size="sillon" disabled={pending}>
          {pending ? "Guardando…" : mode === "create" ? "Crear paciente" : "Guardar cambios"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sillon"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
