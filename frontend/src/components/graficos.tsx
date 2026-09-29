import type { ReactNode } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatMin, formatMinEixo } from "@/lib/format"

export const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export interface ItemGrafico {
  rotulo: string
  valor: number
  cor?: string
  destaque?: boolean
  detalhes?: ReactNode
}

function Dica({ item }: { item?: ItemGrafico }) {
  if (!item) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{item.rotulo}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatMin(item.valor)} parado</p>
      {item.detalhes && <div className="mt-1 text-muted-foreground">{item.detalhes}</div>}
    </div>
  )
}

type TooltipArgs = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }
const conteudoDica = ({ active, payload }: TooltipArgs) =>
  active && payload?.length ? <Dica item={payload[0].payload as ItemGrafico} /> : null

export function GraficoBarras({
  dados,
  altura = 280,
  onSelecionar,
  rotuloEixo,
}: {
  dados: ItemGrafico[]
  altura?: number
  onSelecionar?: (item: ItemGrafico, indice: number) => void
  rotuloEixo?: (rotulo: string) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="rotulo"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={rotuloEixo}
          interval="preserveStartEnd"
          minTickGap={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={formatMinEixo}
        />
        <Tooltip content={conteudoDica} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
        <Bar
          dataKey="valor"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
          className={onSelecionar ? "cursor-pointer" : undefined}
          onClick={(_, indice) => onSelecionar?.(dados[indice], indice)}
        >
          {dados.map((d, i) => (
            <Cell key={i} fill={d.cor ?? CORES[0]} fillOpacity={d.destaque === false ? 0.45 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function GraficoBarrasHorizontais({ dados, altura }: { dados: ItemGrafico[]; altura?: number }) {
  return (
    <ResponsiveContainer width="100%" height={altura ?? Math.max(160, dados.length * 36)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={formatMinEixo} />
        <YAxis
          type="category"
          dataKey="rotulo"
          tickLine={false}
          axisLine={false}
          width={140}
          tick={{ fontSize: 11, fill: "var(--foreground)" }}
          tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
        />
        <Tooltip content={conteudoDica} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
        <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {dados.map((d, i) => (
            <Cell key={i} fill={d.cor ?? CORES[1]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function GraficoArea({
  dados,
  altura = 260,
  rotuloEixo,
}: {
  dados: ItemGrafico[]
  altura?: number
  rotuloEixo?: (rotulo: string) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <AreaChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradTempo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="rotulo"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={rotuloEixo}
          minTickGap={24}
        />
        <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={formatMinEixo} />
        <Tooltip content={conteudoDica} />
        <Area type="monotone" dataKey="valor" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gradTempo)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
