import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Calculator, Clock, Flag, Gauge, LocateFixed, Pencil, Plus, RefreshCw, Trash2, Wallet, X } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import { Campo, Carregando, ErroCarregamento, KpiCard, PageHeader, Spinner, StatusBadge } from "@/components/comum"
import { SeletorPonto } from "@/components/SeletorPonto"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { usePontos } from "@/hooks/queries"
import { api, mensagemErro } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { parseNumero } from "@/lib/form"
import {
  deInputDataHora,
  formatData,
  formatDataHora,
  formatHora,
  formatKm,
  formatMin,
  formatMoeda,
  formatPct,
  paraInputDataHora,
} from "@/lib/format"
import type { Parada, RoteiroDetalhe as Roteiro } from "@/lib/types"

/** Opções padrão das mutações que devolvem o roteiro atualizado. */
function useAcaoRoteiro(roteiroId: number) {
  const queryClient = useQueryClient()
  return <V = void,>(fn: (v: V) => Promise<{ data: Roteiro }>, sucesso: string, onOk?: () => void) => ({
    mutationFn: async (v: V) => (await fn(v)).data,
    onSuccess: (r: Roteiro) => {
      queryClient.setQueryData(["roteiro", roteiroId], r)
      queryClient.invalidateQueries({ queryKey: ["roteiros"] })
      queryClient.invalidateQueries({ queryKey: ["coleta"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success(sucesso)
      onOk?.()
    },
    onError: (e: unknown) => toast.error(mensagemErro(e)),
  })
}

function CorrecaoDialog({ roteiro, parada, onClose }: { roteiro: Roteiro; parada: Parada; onClose: () => void }) {
  const [chegada, setChegada] = useState(paraInputDataHora(parada.chegada_em))
  const [saida, setSaida] = useState(paraInputDataHora(parada.saida_em))
  const opcoes = useAcaoRoteiro(roteiro.id)
  const salvar = useMutation(
    opcoes(
      () =>
        api.put<Roteiro>(`/roteiros/${roteiro.id}/paradas/${parada.id}`, {
          ...(parada.eh_partida ? {} : { chegada_em: deInputDataHora(chegada) }),
          saida_em: deInputDataHora(saida),
        }),
      "Horários corrigidos. A alteração foi registrada na auditoria.",
      onClose,
    ),
  )
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corrigir horários — ponto {parada.ordem}</DialogTitle>
          <DialogDescription>
            {parada.ponto_descricao} · {parada.endereco}
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-correcao"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            salvar.mutate()
          }}
        >
          {!parada.eh_partida && (
            <Campo label="Chegada" htmlFor="chegada">
              <Input id="chegada" type="datetime-local" value={chegada} onChange={(e) => setChegada(e.target.value)} />
            </Campo>
          )}
          <Campo label={parada.eh_partida ? "Saída da partida" : "Saída"} htmlFor="saida">
            <Input id="saida" type="datetime-local" value={saida} onChange={(e) => setSaida(e.target.value)} />
          </Campo>
          <p className="text-xs text-muted-foreground">Deixe em branco para remover o registro. Os horários precisam seguir a ordem do trajeto.</p>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-correcao" disabled={salvar.isPending}>
            {salvar.isPending && <Spinner />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DistanciaDialog({ roteiro, onClose }: { roteiro: Roteiro; onClose: () => void }) {
  const [manual, setManual] = useState(roteiro.distancia_manual)
  const [valor, setValor] = useState(String(roteiro.distancia_total_km).replace(".", ","))
  const opcoes = useAcaoRoteiro(roteiro.id)
  const numero = parseNumero(valor)
  const salvar = useMutation(
    opcoes(
      () =>
        api.put<Roteiro>(
          `/roteiros/${roteiro.id}`,
          manual ? { distancia_total_km: numero, distancia_manual: true } : { distancia_manual: false },
        ),
      "Distância atualizada e custo recalculado.",
      onClose,
    ),
  )
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Distância percorrida</DialogTitle>
          <DialogDescription>
            Por padrão a distância é a soma em linha reta entre os pontos. Informe o valor real (ex.: hodômetro) para um custo mais preciso.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={manual} onCheckedChange={setManual} />
          Informar distância manualmente
        </label>
        {manual && (
          <Campo label="Distância (km)" htmlFor="distancia" erro={Number.isNaN(numero) || numero < 0 ? "Valor inválido" : undefined}>
            <Input id="distancia" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Campo>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || (manual && (Number.isNaN(numero) || numero < 0))}>
            {salvar.isPending && <Spinner />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LinkGps({ lat, lng, rotulo }: { lat: number | null; lng: number | null; rotulo: string }) {
  if (lat == null || lng == null) return null
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noreferrer"
      title={`Localização registrada na ${rotulo}`}
      className="inline-flex text-emerald-600 hover:text-emerald-800"
    >
      <LocateFixed className="size-3.5" />
    </a>
  )
}

export default function RoteiroDetalhe() {
  const { id } = useParams()
  const roteiroId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { temPerfil } = useAuth()
  const gestor = temPerfil("ADMIN", "GERENTE")
  const opcoes = useAcaoRoteiro(roteiroId)

  const [corrigindo, setCorrigindo] = useState<Parada | null>(null)
  const [editandoDistancia, setEditandoDistancia] = useState(false)
  const [novoPonto, setNovoPonto] = useState("")

  const { data: roteiro, isLoading, isError } = useQuery({
    queryKey: ["roteiro", roteiroId],
    queryFn: async () => (await api.get<Roteiro>(`/roteiros/${roteiroId}`)).data,
  })
  const { data: pontos } = usePontos({ ativos: true })

  const recalcular = useMutation(opcoes(() => api.post<Roteiro>(`/roteiros/${roteiroId}/recalcular`), "Indicadores recalculados com os parâmetros atuais."))
  const adicionar = useMutation(
    opcoes(() => api.post<Roteiro>(`/roteiros/${roteiroId}/paradas`, { ponto_id: Number(novoPonto) }), "Ponto adicionado ao final do roteiro.", () => setNovoPonto("")),
  )
  const remover = useMutation(
    opcoes((paradaId: number) => api.delete<Roteiro>(`/roteiros/${roteiroId}/paradas/${paradaId}`), "Ponto removido."),
  )
  const excluir = useMutation({
    mutationFn: () => api.delete(`/roteiros/${roteiroId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roteiros"] })
      toast.success("Roteiro excluído.")
      navigate("/roteiros")
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })

  if (isLoading) return <Carregando linhas={8} />
  if (isError || !roteiro) return <ErroCarregamento mensagem="Roteiro não encontrado ou sem permissão de acesso." />

  const concluidos = roteiro.paradas.filter((p) => !p.eh_partida && p.saida_em).length

  return (
    <>
      <PageHeader
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {roteiro.nome ?? `Roteiro #${roteiro.id}`} <StatusBadge status={roteiro.status} />
          </span>
        }
        descricao={`${formatData(roteiro.data)} · ${roteiro.motorista_nome}`}
        acoes={
          gestor && (
            <>
              {roteiro.status === "PLANEJADO" && (
                <Button variant="outline" asChild>
                  <Link to={`/roteiros/${roteiro.id}/editar`}>
                    <Pencil />
                    Editar
                  </Link>
                </Button>
              )}
              <Button variant="outline" onClick={() => recalcular.mutate()} disabled={recalcular.isPending}>
                <RefreshCw className={recalcular.isPending ? "animate-spin" : undefined} />
                Recalcular
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir roteiro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Os pontos e horários deste roteiro serão removidos do histórico. A exclusão fica registrada na auditoria.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => excluir.mutate()}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          titulo="Tempo parado"
          valor={formatMin(roteiro.tempo_total_parado_min)}
          detalhe={`${formatPct(roteiro.percentual_jornada)} da jornada de ${roteiro.jornada_padrao_horas} h`}
          icone={Clock}
          destaque
        />
        <KpiCard titulo="Pontos concluídos" valor={`${concluidos} / ${roteiro.paradas.length - 1}`} detalhe="Sem contar a partida" icone={Flag} />
        <KpiCard
          titulo="Distância"
          valor={formatKm(roteiro.distancia_total_km)}
          detalhe={
            <span className="flex items-center gap-1">
              {roteiro.distancia_manual ? "Informada manualmente" : "Estimada (linha reta)"}
              {gestor && (
                <button className="text-primary hover:underline" onClick={() => setEditandoDistancia(true)}>
                  · alterar
                </button>
              )}
            </span>
          }
          icone={Gauge}
        />
        <KpiCard
          titulo="Custo estimado"
          valor={formatMoeda(roteiro.custo_estimado)}
          detalhe={`${formatMoeda(roteiro.custo_por_km)} por km`}
          icone={Wallet}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pontos do roteiro</CardTitle>
          <CardDescription>
            Tempo parado = saída − chegada. O ponto 1 (partida) não conta tempo. Total = soma dos demais pontos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Ponto / endereço</TableHead>
                <TableHead>Chegada</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead className="text-right">Tempo parado</TableHead>
                {gestor && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roteiro.paradas.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium tabular-nums">{p.eh_partida ? <Flag className="size-4" /> : p.ordem}</TableCell>
                  <TableCell className="max-w-80">
                    <p className="truncate font-medium">{p.ponto_descricao}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.endereco}</p>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {p.eh_partida ? (
                      "—"
                    ) : (
                      <span className="flex items-center gap-1.5" title={formatDataHora(p.chegada_em)}>
                        {formatHora(p.chegada_em)} <LinkGps lat={p.chegada_lat} lng={p.chegada_lng} rotulo="chegada" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <span className="flex items-center gap-1.5" title={formatDataHora(p.saida_em)}>
                      {formatHora(p.saida_em)} <LinkGps lat={p.saida_lat} lng={p.saida_lng} rotulo="saída" />
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {p.eh_partida ? <span className="text-xs font-normal text-muted-foreground">partida · não conta</span> : formatMin(p.tempo_parado_min)}
                  </TableCell>
                  {gestor && (
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="icon-sm" onClick={() => setCorrigindo(p)} aria-label="Corrigir horários" title="Corrigir horários">
                          <Pencil />
                        </Button>
                        {!p.chegada_em && !p.saida_em && roteiro.paradas.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => remover.mutate(p.id)}
                            disabled={remover.isPending}
                            aria-label="Remover ponto"
                            title="Remover ponto"
                          >
                            <X />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell />
                <TableCell colSpan={3} className="font-medium">
                  Total parado (exceto partida)
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatMin(roteiro.tempo_total_parado_min)}</TableCell>
                {gestor && <TableCell />}
              </TableRow>
            </TableBody>
          </Table>

          {gestor && roteiro.status !== "CONCLUIDO" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <SeletorPonto
                pontos={pontos}
                valor={novoPonto}
                onChange={setNovoPonto}
                placeholder="Adicionar ponto ao final do roteiro"
                className="sm:max-w-xl"
              />
              <Button variant="secondary" className="shrink-0" disabled={!novoPonto || adicionar.isPending} onClick={() => adicionar.mutate()}>
                <Plus />
                Adicionar
              </Button>
            </div>
          )}
          {gestor && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calculator className="size-3.5" />
              Custo recalculado automaticamente a cada alteração. Use "Recalcular" para aplicar parâmetros alterados depois.
            </p>
          )}
        </CardContent>
      </Card>

      {corrigindo && <CorrecaoDialog roteiro={roteiro} parada={corrigindo} onClose={() => setCorrigindo(null)} />}
      {editandoDistancia && <DistanciaDialog roteiro={roteiro} onClose={() => setEditandoDistancia(false)} />}
    </>
  )
}
