import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Download, History, Search } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { Carregando, ErroCarregamento, PageHeader, Vazio } from "@/components/comum"
import { FiltroMotorista, FiltroPeriodo } from "@/components/filtros"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, baixarArquivo, limparParams, mensagemErro } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { diasAtrasIso, formatData, formatHora, formatMin, hojeIso } from "@/lib/format"
import type { HistoricoItem, Pagina } from "@/lib/types"

const POR_PAGINA = 50

export default function Historico() {
  const { usuario } = useAuth()
  const ehMotorista = usuario?.perfil === "MOTORISTA"
  const [periodo, setPeriodo] = useState({ inicio: diasAtrasIso(29), fim: hojeIso() })
  const [motorista, setMotorista] = useState("")
  const [busca, setBusca] = useState("")
  const [buscaAplicada, setBuscaAplicada] = useState("")
  const [somenteComTempo, setSomenteComTempo] = useState(false)
  const [pagina, setPagina] = useState(1)

  const filtros = { ...periodo, motorista_id: motorista, busca: buscaAplicada }
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["historico", filtros, somenteComTempo, pagina],
    queryFn: async () =>
      (
        await api.get<Pagina<HistoricoItem>>("/historico", {
          params: limparParams({ ...filtros, somente_com_tempo: somenteComTempo, page: pagina, page_size: POR_PAGINA }),
        })
      ).data,
    placeholderData: keepPreviousData,
  })

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / POR_PAGINA)) : 1
  const resetar = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPagina(1)
  }

  const exportar = async () => {
    try {
      await baixarArquivo("/relatorios/paradas.csv", filtros, "historico.csv")
    } catch (e) {
      toast.error(mensagemErro(e, "Falha ao exportar."))
    }
  }

  return (
    <>
      <PageHeader
        titulo={ehMotorista ? "Meu histórico" : "Histórico"}
        descricao="Pontos e tempos parados por período, com endereços e horários de chegada e saída."
        acoes={
          <Button variant="outline" onClick={exportar}>
            <Download />
            Exportar CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3">
          <FiltroPeriodo inicio={periodo.inicio} fim={periodo.fim} onChange={(inicio, fim) => resetar(setPeriodo)({ inicio, fim })} />
          <FiltroMotorista valor={motorista} onChange={resetar(setMotorista)} />
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              resetar(setBuscaAplicada)(busca)
            }}
          >
            <div>
              <Label htmlFor="busca" className="mb-1.5 text-xs text-muted-foreground">
                Endereço ou ponto
              </Label>
              <Input id="busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: Rua Peru" className="w-52" />
            </div>
            <Button type="submit" variant="secondary" size="icon" aria-label="Buscar">
              <Search />
            </Button>
          </form>
          <label className="flex h-8 items-center gap-2 text-sm">
            <Switch checked={somenteComTempo} onCheckedChange={resetar(setSomenteComTempo)} />
            Só paradas com tempo
          </label>
        </CardContent>
      </Card>

      {isLoading ? (
        <Carregando linhas={8} />
      ) : isError || !data ? (
        <ErroCarregamento />
      ) : !data.items.length ? (
        <Vazio icone={History} titulo="Nada encontrado" descricao="Ajuste o período ou os filtros." />
      ) : (
        <Card className={isFetching ? "opacity-70 transition-opacity" : undefined}>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  {!ehMotorista && <TableHead>Motorista</TableHead>}
                  <TableHead>Roteiro</TableHead>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Ponto / endereço</TableHead>
                  <TableHead>Chegada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead className="text-right">Tempo parado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <TableRow key={p.parada_id}>
                    <TableCell className="tabular-nums">{formatData(p.data)}</TableCell>
                    {!ehMotorista && <TableCell className="font-medium">{p.motorista_nome}</TableCell>}
                    <TableCell>
                      <Link to={`/roteiros/${p.roteiro_id}`} className="hover:underline">
                        {p.roteiro_nome ?? `#${p.roteiro_id}`}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{p.ordem}</TableCell>
                    <TableCell className="max-w-80">
                      <p className="truncate font-medium">{p.ponto_descricao}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.endereco}</p>
                    </TableCell>
                    <TableCell className="tabular-nums">{p.eh_partida ? "—" : formatHora(p.chegada_em)}</TableCell>
                    <TableCell className="tabular-nums">{formatHora(p.saida_em)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {p.eh_partida ? <span className="text-xs font-normal text-muted-foreground">partida</span> : formatMin(p.tempo_parado_min)}
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
