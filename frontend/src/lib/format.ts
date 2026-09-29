import { endOfMonth, format, parseISO, startOfMonth, subDays } from "date-fns"
import { ptBR } from "date-fns/locale"

export const APP_NAME = import.meta.env.VITE_APP_NAME || "PontoaPonto"

/** 75 → "1h 15min"; 8.4 → "8min"; null → "—" */
export function formatMin(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined) return "—"
  const total = Math.round(minutos)
  if (total < 60) return `${total}min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h}h ${m.toString().padStart(2, "0")}min` : `${h}h`
}

/** Rótulo curto para eixos de gráfico. */
export function formatMinEixo(minutos: number): string {
  if (minutos >= 120) return `${Math.round(minutos / 60)}h`
  return `${Math.round(minutos)}min`
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })

export const formatMoeda = (v: number | null | undefined) => (v == null ? "—" : moeda.format(v))
export const formatNumero = (v: number | null | undefined, sufixo = "") =>
  v == null ? "—" : `${numero.format(v)}${sufixo}`
export const formatKm = (v: number | null | undefined) => formatNumero(v, " km")
export const formatPct = (v: number | null | undefined) => formatNumero(v, "%")

/** "2026-09-28" (date) ou ISO datetime → Date local. */
function toDate(valor: string): Date {
  return valor.length === 10 ? parseISO(`${valor}T00:00:00`) : parseISO(valor)
}

export const formatData = (v: string | null | undefined) => (v ? format(toDate(v), "dd/MM/yyyy") : "—")
export const formatDataCurta = (v: string) => format(toDate(v), "dd/MM")
export const formatHora = (v: string | null | undefined) => (v ? format(parseISO(v), "HH:mm") : "—")
export const formatDataHora = (v: string | null | undefined) =>
  v ? format(parseISO(v), "dd/MM/yyyy HH:mm") : "—"
const inicialMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const formatDataExtenso = (v: string) => inicialMaiuscula(format(toDate(v), "EEEE, dd 'de' MMMM", { locale: ptBR }))
export const formatMes = (chave: string) => format(parseISO(`${chave}-01T00:00:00`), "MMM/yy", { locale: ptBR })
export const formatMesExtenso = (chave: string) =>
  inicialMaiuscula(format(parseISO(`${chave}-01T00:00:00`), "MMMM 'de' yyyy", { locale: ptBR }))

// ---------- datas para filtros (yyyy-MM-dd) ----------

export const isoDate = (d: Date) => format(d, "yyyy-MM-dd")
export const hojeIso = () => isoDate(new Date())
export const diasAtrasIso = (dias: number) => isoDate(subDays(new Date(), dias))
export const mesAtual = () => format(new Date(), "yyyy-MM")
export function limitesDoMes(chave: string): { inicio: string; fim: string } {
  const d = parseISO(`${chave}-01T00:00:00`)
  return { inicio: isoDate(startOfMonth(d)), fim: isoDate(endOfMonth(d)) }
}

/** ISO → valor para <input type="datetime-local"> */
export const paraInputDataHora = (v: string | null) => (v ? format(parseISO(v), "yyyy-MM-dd'T'HH:mm") : "")
/** Valor de <input type="datetime-local"> (hora local) → ISO com fuso */
export const deInputDataHora = (v: string) => (v ? new Date(v).toISOString() : null)

export const STATUS_LABEL: Record<string, string> = {
  PLANEJADO: "Planejado",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
}

export const PERFIL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente / coordenador",
  MOTORISTA: "Motorista / motoboy",
}

/** Link de navegação para o endereço (Google Maps). */
export function linkNavegacao(p: { latitude: number | null; longitude: number | null; endereco: string }) {
  const destino = p.latitude != null && p.longitude != null ? `${p.latitude},${p.longitude}` : p.endereco
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`
}
