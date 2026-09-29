import type { LucideIcon } from "lucide-react"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { STATUS_LABEL } from "@/lib/format"
import type { StatusRoteiro } from "@/lib/types"
import { cn } from "@/lib/utils"

export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: ReactNode
  descricao?: ReactNode
  acoes?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  )
}

export function KpiCard({
  titulo,
  valor,
  detalhe,
  icone: Icone,
  destaque,
}: {
  titulo: string
  valor: ReactNode
  detalhe?: ReactNode
  icone?: LucideIcon
  destaque?: boolean
}) {
  return (
    <Card size="sm" className={cn(destaque && "ring-primary/30 bg-primary/[0.03]")}>
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{titulo}</p>
          {Icone && <Icone className={cn("size-4 text-muted-foreground", destaque && "text-primary")} />}
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{valor}</p>
        {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  )
}

const STATUS_CLASSES: Record<StatusRoteiro, string> = {
  PLANEJADO: "bg-slate-100 text-slate-700",
  EM_ANDAMENTO: "bg-amber-100 text-amber-800",
  CONCLUIDO: "bg-emerald-100 text-emerald-800",
}

export function StatusBadge({ status }: { status: StatusRoteiro }) {
  return <Badge className={STATUS_CLASSES[status]}>{STATUS_LABEL[status]}</Badge>
}

export function Campo({
  label,
  erro,
  ajuda,
  htmlFor,
  className,
  children,
}: {
  label: string
  erro?: string
  ajuda?: ReactNode
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {erro ? (
        <p className="text-xs text-destructive">{erro}</p>
      ) : (
        ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>
      )}
    </div>
  )
}

export function Vazio({ icone: Icone, titulo, descricao, acao }: { icone?: LucideIcon; titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      {Icone && <Icone className="size-8 text-muted-foreground" />}
      <p className="font-medium">{titulo}</p>
      {descricao && <p className="max-w-sm text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  )
}

export function Carregando({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />
}

export function ErroCarregamento({ mensagem = "Não foi possível carregar os dados." }: { mensagem?: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
      {mensagem}
    </div>
  )
}
