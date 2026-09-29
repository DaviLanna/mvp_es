import { z } from "zod"

/** Aceita vírgula ou ponto como separador decimal. */
export const parseNumero = (v: string) => Number(v.trim().replace(",", "."))

export const numeroOuNull = (v: string | undefined) => (!v || v.trim() === "" ? null : parseNumero(v))

export const campoNumero = ({ obrigatorio = false, min, maior = false }: { obrigatorio?: boolean; min?: number; maior?: boolean } = {}) =>
  z
    .string()
    .trim()
    .refine((v) => !obrigatorio || v !== "", "Campo obrigatório")
    .refine((v) => v === "" || !Number.isNaN(parseNumero(v)), "Informe um número válido")
    .refine(
      (v) => v === "" || min === undefined || (maior ? parseNumero(v) > min : parseNumero(v) >= min),
      maior ? `Deve ser maior que ${min}` : `Deve ser no mínimo ${min}`,
    )

export const campoEmail = z.string().trim().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "E-mail inválido")

/** Converte string vazia em null (campos opcionais de texto). */
export const textoOuNull = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null)
