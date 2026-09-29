import { useQuery } from "@tanstack/react-query"
import { addDays, addMonths, differenceInCalendarDays, format, parseISO, subMonths } from "date-fns"
import { ChevronLeft, ChevronRight, Clock, Download, Gauge, MapPinned, Percent, Route, Wallet } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { Carregando, ErroCarregamento, KpiCard, PageHeader, Vazio } from "@/components/comum"
import { FiltroMotorista, FiltroPeriodo } from "@/components/filtros"
import { CORES, GraficoArea, GraficoBarras, GraficoBarrasHorizontais, type ItemGrafico } from "@/components/graficos"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, baixarArquivo, limparParams, mensagemErro } from "@/lib/api"
import {
  diasAtrasIso,
  formatData,
  formatDataCurta,
  formatDataExtenso,
  formatHora,
  formatKm,
  formatMes,
  formatMesExtenso,
  formatMin,
  formatMoeda,
  formatPct,
  hojeIso,
  isoDate,
  limitesDoMes,
  mesAtual,
} from "@/lib/format"
import type { DashboardDia, DashboardPeriodo, PontoSerie, Resumo } from "@/lib/types"

type Aba = "dia" | "mes" | "periodo"

function useDashboard<T>(recurso: string, params: Record<string, unknown>) {
  return useQuery({
    queryKey: ["dashboard", recurso, params],
    queryFn: async () => (await api.get<T>(`/dashboard/${recurso}`, { params: limparParams(params) })).data,
  })
}

function Kpis({ resumo }: { resumo: Resumo }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <KpiCard
        titulo="Tempo parado"
        valor={formatMin(resumo.tempo_total_parado_min)}
        detalhe={`${resumo.qtd_paradas} paradas · média ${formatMin(resumo.media_por_parada_min)}`}
        icone={Clock}
        destaque
      />
      <KpiCard
        titulo="% da jornada"
        valor={formatPct(resumo.percentual_jornada)}
        detalhe={`Base: ${resumo.dias_motorista} dia(s) × ${resumo.jornada_padrao_horas} h`}
        icone={Percent}
      />
      <KpiCard
        titulo="Roteiros"
        valor={resumo.qtd_roteiros}
        detalhe={`Média ${formatMin(resumo.media_por_roteiro_min)} parado`}
        icone={Route}
      />
      <KpiCard titulo="Distância" valor={formatKm(resumo.distancia_total_km)} icone={Gauge} />
      <KpiCard titulo="Custo estimado" valor={formatMoeda(resumo.custo_total)} icone={Wallet} />
    </div>
  )
}

function BotaoExportar({ inicio, fim, motorista }: { inicio: string; fim: string; motorista: string }) {
  const [baixando, setBaixando] = useState(false)
  const exportar = async () => {
    setBaixando(true)
    try {
      await baixarArquivo("/relatorios/paradas.csv", { inicio, fim, motorista_id: motorista }, "paradas.csv")
    } catch (e) {
      toast.error(mensagemErro(e, "Falha ao exportar."))
    } finally {
      setBaixando(false)
    }
  }
  return (
    <Button variant="outline" onClick={exportar} disabled={baixando}>
      <Download />
      Exportar CSV
    </Button>
  )
}

function Navegador({ rotulo, anterior, proximo, children }: { rotulo?: string; anterior: () => void; proximo: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" onClick={anterior} aria-label={`${rotulo ?? ""} anterior`}>
        <ChevronLeft />
      </Button>
      {children}
      <Button variant="outline" size="icon" onClick={proximo} aria-label={`Próximo ${rotulo ?? ""}`}>
        <ChevronRight />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------- Dia

function AbaDia({ data, setData, motorista }: { data: string; setData: (d: string) => void; motorista: string }) {
  const { data: dia, isLoading, isError } = useDashboard<DashboardDia>("dia", { data, motorista_id: motorista })
  const mudar = (dias: number) => setData(isoDate(addDays(parseISO(`${data}T00:00:00`), dias)))

  const motoristas = [...new Set(dia?.paradas.map((p) => p.motorista_nome))]
  const corDe = (nome: string) => CORES[motoristas.indexOf(nome) % CORES.length]
  const barras: ItemGrafico[] =
    dia?.paradas
      .filter((p) => !p.eh_partida && p.tempo_parado_min != null)
      .map((p) => ({
        rotulo: `${p.ordem}. ${p.ponto_descricao}`,
        valor: p.tempo_parado_min!,
        cor: corDe(p.motorista_nome),
        detalhes: (
          <>
            <p>{p.motorista_nome} · {p.roteiro_nome ?? `Roteiro #${p.roteiro_id}`}</p>
            <p>{p.endereco}</p>
            <p>
              Chegada {formatHora(p.chegada_em)} · Saída {formatHora(p.saida_em)}
            </p>
          </>
        ),
      })) ?? []

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Navegador rotulo="dia" anterior={() => mudar(-1)} proximo={() => mudar(1)}>
          <Input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} className="w-40" />
        </Navegador>
        <p className="text-sm text-muted-foreground">{formatDataExtenso(data)}</p>
        <BotaoExportar inicio={data} fim={data} motorista={motorista} />
      </div>

      {isLoading ? (
        <Carregando linhas={5} />
      ) : isError || !dia ? (
        <ErroCarregamento />
      ) : !dia.paradas.length ? (
        <Vazio icone={Route} titulo="Nenhum roteiro neste dia" descricao="Escolha outra data ou veja os recortes por mês e período." />
      ) : (
        <>
          <Kpis resumo={dia.resumo} />
          <Card>
            <CardHeader>
              <CardTitle>Tempo parado por ponto</CardTitle>
              <CardDescription>Cada barra é uma parada do dia. A partida não conta tempo.</CardDescription>
            </CardHeader>
            <CardContent>
              {barras.length ? (
                <>
                  <GraficoBarras dados={barras} rotuloEixo={(r) => (r.length > 14 ? `${r.slice(0, 13)}…` : r)} />
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {motoristas.map((m) => (
                      <span key={m} className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm" style={{ background: corDe(m) }} />
                        {m}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma parada com saída registrada ainda.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Paradas do dia</CardTitle>
              <CardDescription>Todo tempo parado está vinculado ao endereço e aos horários registrados.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Motorista / roteiro</TableHead>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Ponto / endereço</TableHead>
                    <TableHead>Chegada</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead className="text-right">Tempo parado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dia.paradas.map((p) => (
                    <TableRow key={p.parada_id}>
                      <TableCell>
                        <p className="font-medium">{p.motorista_nome}</p>
                        <Link to={`/roteiros/${p.roteiro_id}`} className="text-xs text-muted-foreground hover:underline">
                          {p.roteiro_nome ?? `Roteiro #${p.roteiro_id}`}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{p.ordem}</TableCell>
                      <TableCell className="max-w-72">
                        <p className="truncate font-medium">{p.ponto_descricao}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.endereco}</p>
                      </TableCell>
                      <TableCell className="tabular-nums">{p.eh_partida ? "—" : formatHora(p.chegada_em)}</TableCell>
                      <TableCell className="tabular-nums">{formatHora(p.saida_em)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {p.eh_partida ? <span className="text-xs font-normal text-muted-foreground">partida · não conta</span> : formatMin(p.tempo_parado_min)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Mês

function itemSerie(p: PontoSerie, rotulo: string): ItemGrafico {
  return {
    rotulo,
    valor: p.tempo_parado_min,
    detalhes: (
      <>
        <p>{p.qtd_roteiros} roteiro(s) · {formatPct(p.percentual_jornada)} da jornada</p>
        <p>Custo {formatMoeda(p.custo_total)}</p>
      </>
    ),
  }
}

function AbaMes({
  mes,
  setMes,
  motorista,
  abrirDia,
}: {
  mes: string
  setMes: (m: string) => void
  motorista: string
  abrirDia: (d: string) => void
}) {
  const { inicio, fim } = limitesDoMes(mes)
  const base = parseISO(`${mes}-01T00:00:00`)
  const inicio12 = isoDate(subMonths(base, 11))
  const params = { inicio, fim, motorista_id: motorista }

  const resumo = useDashboard<Resumo>("resumo", params)
  const porDia = useDashboard<PontoSerie[]>("por-dia", params)
  const porMes = useDashboard<PontoSerie[]>("por-mes", { inicio: inicio12, fim, motorista_id: motorista })
  const mudar = (n: number) => setMes(format(addMonths(base, n), "yyyy-MM"))

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Navegador rotulo="mês" anterior={() => mudar(-1)} proximo={() => mudar(1)}>
          <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="w-48" />
        </Navegador>
        <p className="text-sm text-muted-foreground">{formatMesExtenso(mes)}</p>
        <BotaoExportar inicio={inicio} fim={fim} motorista={motorista} />
      </div>

      {resumo.isLoading ? <Carregando linhas={2} /> : resumo.data ? <Kpis resumo={resumo.data} /> : <ErroCarregamento />}

      <Card>
        <CardHeader>
          <CardTitle>Tempo parado por dia</CardTitle>
          <CardDescription>Clique em um dia para ver as paradas com endereço e horários.</CardDescription>
        </CardHeader>
        <CardContent>
          {porDia.isLoading ? (
            <Carregando linhas={5} />
          ) : (
            <GraficoBarras
              dados={(porDia.data ?? []).map((p) => itemSerie(p, formatDataCurta(p.chave)))}
              onSelecionar={(_, i) => porDia.data && abrirDia(porDia.data[i].chave)}
              rotuloEixo={(r) => r.slice(0, 2)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tempo parado por mês</CardTitle>
          <CardDescription>Últimos 12 meses até {formatMesExtenso(mes).toLowerCase()}. Clique para trocar o mês.</CardDescription>
        </CardHeader>
        <CardContent>
          {porMes.isLoading ? (
            <Carregando linhas={5} />
          ) : (
            <GraficoBarras
              dados={(porMes.data ?? []).map((p) => ({ ...itemSerie(p, formatMes(p.chave)), destaque: p.chave === mes }))}
              onSelecionar={(_, i) => porMes.data && setMes(porMes.data[i].chave)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- Período

const ATALHOS = [
  { rotulo: "7 dias", dias: 7 },
  { rotulo: "30 dias", dias: 30 },
  { rotulo: "90 dias", dias: 90 },
  { rotulo: "12 meses", dias: 365 },
]

function AbaPeriodo({
  periodo,
  setPeriodo,
  motorista,
}: {
  periodo: { inicio: string; fim: string }
  setPeriodo: (p: { inicio: string; fim: string }) => void
  motorista: string
}) {
  const params = { ...periodo, motorista_id: motorista }
  const dias = differenceInCalendarDays(parseISO(periodo.fim), parseISO(periodo.inicio)) + 1
  const mensal = dias > 120
  const dados = useDashboard<DashboardPeriodo>("por-periodo", params)
  const serie = useDashboard<PontoSerie[]>(mensal ? "por-mes" : "por-dia", params)

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <FiltroPeriodo inicio={periodo.inicio} fim={periodo.fim} onChange={(inicio, fim) => setPeriodo({ inicio, fim })} />
          <div className="flex gap-1">
            {ATALHOS.map((a) => (
              <Button key={a.dias} variant="ghost" size="sm" onClick={() => setPeriodo({ inicio: diasAtrasIso(a.dias - 1), fim: hojeIso() })}>
                {a.rotulo}
              </Button>
            ))}
          </div>
        </div>
        <BotaoExportar inicio={periodo.inicio} fim={periodo.fim} motorista={motorista} />
      </div>

      {dados.isLoading ? (
        <Carregando linhas={6} />
      ) : dados.isError || !dados.data ? (
        <ErroCarregamento />
      ) : (
        <>
          <Kpis resumo={dados.data.resumo} />

          <Card>
            <CardHeader>
              <CardTitle>Evolução do tempo parado</CardTitle>
              <CardDescription>
                {formatData(periodo.inicio)} a {formatData(periodo.fim)} · {mensal ? "agrupado por mês" : "por dia"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {serie.isLoading ? (
                <Carregando linhas={5} />
              ) : (
                <GraficoArea
                  dados={(serie.data ?? []).map((p) => itemSerie(p, mensal ? formatMes(p.chave) : formatDataCurta(p.chave)))}
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPinned className="size-4" /> Endereços com mais tempo parado
                </CardTitle>
                <CardDescription>Gargalos do período: soma e média por ponto.</CardDescription>
              </CardHeader>
              <CardContent>
                {dados.data.por_endereco.length ? (
                  <GraficoBarrasHorizontais
                    dados={dados.data.por_endereco.map((e) => ({
                      rotulo: e.descricao,
                      valor: e.tempo_parado_min,
                      detalhes: (
                        <>
                          <p>{e.endereco}</p>
                          <p>
                            {e.qtd_paradas} paradas · média {formatMin(e.media_min)}
                          </p>
                        </>
                      ),
                    }))}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sem paradas no período.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Por motorista</CardTitle>
                <CardDescription>Percentual sobre a jornada padrão dos dias trabalhados.</CardDescription>
                <CardAction>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/historico">Ver histórico</Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Motorista</TableHead>
                      <TableHead className="text-right">Roteiros</TableHead>
                      <TableHead className="text-right">Tempo parado</TableHead>
                      <TableHead className="text-right">% jornada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.data.por_motorista.map((m) => (
                      <TableRow key={m.motorista_id}>
                        <TableCell className="font-medium">{m.nome}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.qtd_roteiros}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMin(m.tempo_parado_min)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPct(m.percentual_jornada)}</TableCell>
                      </TableRow>
                    ))}
                    {!dados.data.por_motorista.length && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                          Sem roteiros no período.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Página

export default function Dashboard() {
  const [aba, setAba] = useState<Aba>("mes")
  const [motorista, setMotorista] = useState("")
  const [dia, setDia] = useState(hojeIso())
  const [mes, setMes] = useState(mesAtual())
  const [periodo, setPeriodo] = useState({ inicio: diasAtrasIso(29), fim: hojeIso() })

  return (
    <>
      <PageHeader
        titulo="Dashboard"
        descricao="Tempo parado dos profissionais de campo por dia, por mês e por período."
        acoes={<FiltroMotorista valor={motorista} onChange={setMotorista} />}
      />
      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="gap-4">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="dia">Dia</TabsTrigger>
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="periodo">Período</TabsTrigger>
        </TabsList>
        <TabsContent value="dia">
          <AbaDia data={dia} setData={setDia} motorista={motorista} />
        </TabsContent>
        <TabsContent value="mes">
          <AbaMes
            mes={mes}
            setMes={setMes}
            motorista={motorista}
            abrirDia={(d) => {
              setDia(d)
              setAba("dia")
            }}
          />
        </TabsContent>
        <TabsContent value="periodo">
          <AbaPeriodo periodo={periodo} setPeriodo={setPeriodo} motorista={motorista} />
        </TabsContent>
      </Tabs>
    </>
  )
}
