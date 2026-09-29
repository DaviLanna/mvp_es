import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react"
import { useState } from "react"

import { Carregando, ErroCarregamento, PageHeader, Vazio } from "@/components/comum"
import { FiltroPeriodo } from "@/components/filtros"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, limparParams } from "@/lib/api"
import { diasAtrasIso, formatDataHora, hojeIso } from "@/lib/format"
import type { AuditoriaItem, Pagina } from "@/lib/types"

const ENTIDADES: Record<string, string> = {
  ponto_roteiro: "Horários / ponto do roteiro",
  roteiro: "Roteiro",
  ponto: "Ponto (endereço)",
  parametro: "Parâmetros",
}
const ACOES: Record<AuditoriaItem["acao"], { rotulo: string; classe: string }> = {
  CREATE: { rotulo: "Criação", classe: "bg-emerald-100 text-emerald-800" },
  UPDATE: { rotulo: "Alteração", classe: "bg-amber-100 text-amber-800" },
  DELETE: { rotulo: "Exclusão", classe: "bg-red-100 text-red-800" },
}
const TODAS = "todas"
const POR_PAGINA = 30

function valor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "∅"
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDataHora(v)
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2)
  return String(v)
}

function Alteracoes({ item }: { item: AuditoriaItem }) {
  if (item.acao === "UPDATE" && item.antes && item.depois) {
    return (
      <ul className="grid gap-0.5 text-xs">
        {Object.keys(item.depois).map((campo) => (
          <li key={campo}>
            <span className="font-medium">{campo}</span>: <span className="text-muted-foreground line-through">{valor(item.antes?.[campo])}</span> →{" "}
            <span>{valor(item.depois?.[campo])}</span>
          </li>
        ))}
      </ul>
    )
  }
  const dados = item.depois ?? item.antes ?? {}
  const resumo = Object.entries(dados)
    .filter(([k, v]) => k !== "id" && v !== null)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${valor(v)}`)
    .join(" · ")
  return <p className="max-w-md truncate text-xs text-muted-foreground" title={resumo}>{resumo}</p>
}

export default function Auditoria() {
  const [periodo, setPeriodo] = useState({ inicio: diasAtrasIso(6), fim: hojeIso() })
  const [entidade, setEntidade] = useState("")
  const [pagina, setPagina] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["auditoria", periodo, entidade, pagina],
    queryFn: async () =>
      (
        await api.get<Pagina<AuditoriaItem>>("/auditoria", {
          params: limparParams({ ...periodo, entidade, page: pagina, page_size: POR_PAGINA }),
        })
      ).data,
    placeholderData: keepPreviousData,
  })
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / POR_PAGINA)) : 1

  return (
    <>
      <PageHeader titulo="Auditoria" descricao="Registro das alterações em pontos, horários, roteiros e parâmetros: quem, quando e o quê." />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3">
          <FiltroPeriodo
            inicio={periodo.inicio}
            fim={periodo.fim}
            onChange={(inicio, fim) => {
              setPeriodo({ inicio, fim })
              setPagina(1)
            }}
          />
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Entidade</Label>
            <Select
              value={entidade || TODAS}
              onValueChange={(v) => {
                setEntidade(v === TODAS ? "" : v)
                setPagina(1)
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas</SelectItem>
                {Object.entries(ENTIDADES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Carregando linhas={8} />
      ) : isError || !data ? (
        <ErroCarregamento />
      ) : !data.items.length ? (
        <Vazio icone={ShieldCheck} titulo="Nenhuma alteração registrada no período" />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Alterações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((a) => (
                  <TableRow key={a.id} className="align-top">
                    <TableCell className="tabular-nums whitespace-nowrap">{formatDataHora(a.criado_em)}</TableCell>
                    <TableCell className="text-xs">{a.usuario_email ?? "sistema"}</TableCell>
                    <TableCell className="text-xs">
                      {ENTIDADES[a.entidade] ?? a.entidade} <span className="text-muted-foreground">#{a.entidade_id}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={ACOES[a.acao].classe}>{ACOES[a.acao].rotulo}</Badge>
                    </TableCell>
                    <TableCell>
                      <Alteracoes item={a} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {data.total} registro(s) · página {pagina} de {totalPaginas}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon-sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} aria-label="Página anterior">
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="icon-sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)} aria-label="Próxima página">
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
