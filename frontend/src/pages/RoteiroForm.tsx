import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, Flag, MapPin, Plus, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import { Campo, Carregando, PageHeader, Spinner } from "@/components/comum"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMotoristas, usePontos } from "@/hooks/queries"
import { api, mensagemErro } from "@/lib/api"
import { formatKm, hojeIso } from "@/lib/format"
import type { Ponto, RoteiroDetalhe } from "@/lib/types"

function haversineKm(a: Ponto, b: Ponto) {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return 0
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h))
}

export default function RoteiroForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: motoristas } = useMotoristas({ ativos: true })
  const { data: pontos } = usePontos({ ativos: true })
  const { data: roteiro, isLoading } = useQuery({
    queryKey: ["roteiro", Number(id)],
    queryFn: async () => (await api.get<RoteiroDetalhe>(`/roteiros/${id}`)).data,
    enabled: editando,
  })

  const [nome, setNome] = useState("")
  const [data, setData] = useState(hojeIso())
  const [motoristaId, setMotoristaId] = useState("")
  const [sequencia, setSequencia] = useState<number[]>([])
  const [pontoParaAdicionar, setPontoParaAdicionar] = useState("")

  useEffect(() => {
    if (!roteiro) return
    setNome(roteiro.nome ?? "")
    setData(roteiro.data)
    setMotoristaId(String(roteiro.motorista_id))
    setSequencia(roteiro.paradas.map((p) => p.ponto_id))
  }, [roteiro])

  const pontosPorId = useMemo(() => new Map(pontos?.map((p) => [p.id, p])), [pontos])
  const pontosSelecionados = sequencia.map((pid) => pontosPorId.get(pid)).filter(Boolean) as Ponto[]
  const distancia = pontosSelecionados.slice(1).reduce((acc, p, i) => acc + haversineKm(pontosSelecionados[i], p), 0)

  const salvar = useMutation({
    mutationFn: async () => {
      const corpo = { nome: nome.trim() || null, data, motorista_id: Number(motoristaId), ponto_ids: sequencia }
      const resp = editando
        ? await api.put<RoteiroDetalhe>(`/roteiros/${id}`, corpo)
        : await api.post<RoteiroDetalhe>("/roteiros", corpo)
      return resp.data
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["roteiros"] })
      queryClient.invalidateQueries({ queryKey: ["roteiro", r.id] })
      queryClient.invalidateQueries({ queryKey: ["coleta"] })
      toast.success(editando ? "Roteiro atualizado." : "Roteiro criado.")
      navigate(`/roteiros/${r.id}`)
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })

  const mover = (indice: number, delta: number) =>
    setSequencia((s) => {
      const nova = [...s]
      const alvo = indice + delta
      ;[nova[indice], nova[alvo]] = [nova[alvo], nova[indice]]
      return nova
    })

  if (editando && isLoading) return <Carregando linhas={6} />
  if (editando && roteiro && roteiro.status !== "PLANEJADO") {
    return (
      <Alert>
        <AlertDescription>
          Este roteiro já teve a coleta iniciada, então a ordem dos pontos não pode mais ser alterada. Na{" "}
          <Link to={`/roteiros/${id}`} className="underline">página do roteiro</Link> você ainda pode adicionar ou remover pontos pendentes.
        </AlertDescription>
      </Alert>
    )
  }

  const valido = motoristaId && data && sequencia.length >= 2

  return (
    <>
      <PageHeader
        titulo={editando ? "Editar roteiro" : "Novo roteiro"}
        descricao="Associe os pontos em ordem sequencial a um motorista e a uma data. O primeiro ponto é a partida e não conta tempo parado."
      />
      <form
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
        onSubmit={(e) => {
          e.preventDefault()
          if (valido) salvar.mutate()
        }}
      >
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Dados do roteiro</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Campo label="Nome (opcional)" htmlFor="nome">
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Roteiro A" maxLength={80} />
            </Campo>
            <Campo label="Data" htmlFor="data">
              <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </Campo>
            <Campo label="Motorista / motoboy">
              <Select value={motoristaId} onValueChange={setMotoristaId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {motoristas?.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.nome} · {m.veiculo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <div className="rounded-lg bg-muted/60 p-3 text-sm">
              <p className="text-muted-foreground">Distância estimada (linha reta entre pontos)</p>
              <p className="text-lg font-semibold tabular-nums">{formatKm(Math.round(distancia * 100) / 100)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pontos em ordem</CardTitle>
            <CardDescription>Adicione pelo menos a partida e um destino.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex gap-2">
              <Select value={pontoParaAdicionar} onValueChange={setPontoParaAdicionar}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha um ponto cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  {pontos?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.descricao} — {p.endereco}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="secondary"
                disabled={!pontoParaAdicionar}
                onClick={() => {
                  setSequencia((s) => [...s, Number(pontoParaAdicionar)])
                  setPontoParaAdicionar("")
                }}
              >
                <Plus />
                Adicionar
              </Button>
            </div>

            {!sequencia.length ? (
              <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                Nenhum ponto adicionado. Não encontrou o endereço? <Link to="/pontos" className="underline">Cadastre um ponto</Link>.
              </p>
            ) : (
              <ol className="grid grid-cols-1 gap-2">
                {sequencia.map((pid, i) => {
                  const p = pontosPorId.get(pid)
                  return (
                    <li key={`${pid}-${i}`} className="flex items-center gap-3 rounded-lg border p-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {i === 0 ? <Flag className="size-3.5" /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {p?.descricao ?? `Ponto #${pid}`}
                          {i === 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">partida · não conta tempo</span>}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="size-3 shrink-0" />
                          {p?.endereco}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir">
                          <ArrowUp />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" disabled={i === sequencia.length - 1} onClick={() => mover(i, 1)} aria-label="Descer">
                          <ArrowDown />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSequencia((s) => s.filter((_, j) => j !== i))} aria-label="Remover">
                          <X />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!valido || salvar.isPending}>
                {salvar.isPending && <Spinner />}
                {editando ? "Salvar alterações" : "Criar roteiro"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </>
  )
}
