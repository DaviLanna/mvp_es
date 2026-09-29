import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Download, Plus, Route } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"

import { Carregando, ErroCarregamento, PageHeader, StatusBadge, Vazio } from "@/components/comum"
import { FiltroMotorista, FiltroPeriodo } from "@/components/filtros"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, baixarArquivo, limparParams, mensagemErro } from "@/lib/api"
import { diasAtrasIso, formatData, formatKm, formatMin, formatMoeda, isoDate, STATUS_LABEL } from "@/lib/format"
import type { Pagina, RoteiroResumo } from "@/lib/types"
import { addDays } from "date-fns"

const POR_PAGINA = 20
const TODOS = "todos"

export default function Roteiros() {
  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState({ inicio: diasAtrasIso(6), fim: isoDate(addDays(new Date(), 7)) })
  const [motorista, setMotorista] = useState("")
  const [status, setStatus] = useState("")
  const [pagina, setPagina] = useState(1)

  const filtros = { ...periodo, motorista_id: motorista, status }
  const { data, isLoading, isError } = useQuery({
    queryKey: ["roteiros", filtros, pagina],
    queryFn: async () =>
      (
        await api.get<Pagina<RoteiroResumo>>("/roteiros", {
          params: limparParams({ ...filtros, page: pagina, page_size: POR_PAGINA }),
        })
      ).data,
    placeholderData: keepPreviousData,
  })
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / POR_PAGINA)) : 1

  const exportar = async () => {
    try {
      await baixarArquivo("/relatorios/roteiros.csv", { ...periodo, motorista_id: motorista }, "roteiros.csv")
    } catch (e) {
      toast.error(mensagemErro(e, "Falha ao exportar."))
    }
  }

  return (
    <>
      <PageHeader
        titulo="Roteiros"
        descricao="Roteiros diários: um motorista, uma data e os pontos em ordem sequencial."
        acoes={
          <>
            <Button variant="outline" onClick={exportar}>
              <Download />
              CSV
            </Button>
            <Button asChild>
              <Link to="/roteiros/novo">
                <Plus />
                Novo roteiro
              </Link>
            </Button>
          </>
        }
      />

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
          <FiltroMotorista
            valor={motorista}
            onChange={(v) => {
              setMotorista(v)
              setPagina(1)
            }}
          />
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Status</Label>
            <Select
              value={status || TODOS}
              onValueChange={(v) => {
                setStatus(v === TODOS ? "" : v)
                setPagina(1)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {Object.entries(STATUS_LABEL).map(([valor, rotulo]) => (
                  <SelectItem key={valor} value={valor}>
                    {rotulo}
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
        <Vazio
          icone={Route}
          titulo="Nenhum roteiro no período"
          acao={
            <Button asChild>
              <Link to="/roteiros/novo">Montar roteiro</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Roteiro</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Pontos</TableHead>
                  <TableHead className="text-right">Distância</TableHead>
                  <TableHead className="text-right">Tempo parado</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/roteiros/${r.id}`)}>
                    <TableCell className="tabular-nums">{formatData(r.data)}</TableCell>
                    <TableCell className="font-medium">{r.nome ?? `#${r.id}`}</TableCell>
                    <TableCell>{r.motorista_nome}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.qtd_pontos}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatKm(r.distancia_total_km)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMin(r.tempo_total_parado_min)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoeda(r.custo_estimado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {data.total} roteiro(s) · página {pagina} de {totalPaginas}
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
