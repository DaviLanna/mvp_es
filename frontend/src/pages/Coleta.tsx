import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { differenceInSeconds, parseISO } from "date-fns"
import { CheckCircle2, Clock, Flag, LogIn, LogOut, MapPin, Navigation, Play, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { Carregando, ErroCarregamento, PageHeader, Spinner, StatusBadge, Vazio } from "@/components/comum"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api, mensagemErro } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDataExtenso, formatHora, formatMin, formatPct, hojeIso, linkNavegacao } from "@/lib/format"
import type { Parada, RoteiroDetalhe } from "@/lib/types"
import { cn } from "@/lib/utils"

type Acao = "chegada" | "saida"

interface ProximoPasso {
  parada: Parada
  acao: Acao
}

/** Próxima ação do motorista: sair da partida, chegar no próximo ponto ou sair do ponto atual. */
function proximoPasso(roteiro: RoteiroDetalhe): ProximoPasso | null {
  for (const parada of roteiro.paradas) {
    if (parada.eh_partida) {
      if (!parada.saida_em) return { parada, acao: "saida" }
      continue
    }
    if (!parada.chegada_em) return { parada, acao: "chegada" }
    if (!parada.saida_em) return { parada, acao: "saida" }
  }
  return null
}

/** Localização do navegador (não bloqueia a coleta se indisponível). */
function obterLocalizacao(): Promise<{ lat: number; lng: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30_000 },
    )
  })
}

function Cronometro({ desde }: { desde: string }) {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const seg = Math.max(0, differenceInSeconds(agora, parseISO(desde)))
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  return <span className="tabular-nums">{h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}</span>
}

function PainelAcao({ roteiro }: { roteiro: RoteiroDetalhe }) {
  const queryClient = useQueryClient()
  const passo = proximoPasso(roteiro)

  const registrar = useMutation({
    mutationFn: async ({ parada, acao }: ProximoPasso) => {
      const local = await obterLocalizacao()
      if (!local) toast.warning("Localização indisponível — o horário será registrado mesmo assim.")
      const url = `/roteiros/${roteiro.id}/paradas/${parada.id}/${acao}`
      return (await api.post<RoteiroDetalhe>(url, local ?? {})).data
    },
    onSuccess: (atualizado, { parada, acao }) => {
      queryClient.invalidateQueries({ queryKey: ["coleta"] })
      queryClient.invalidateQueries({ queryKey: ["roteiro", roteiro.id] })
      if (parada.eh_partida) toast.success("Roteiro iniciado. Bom trabalho!")
      else if (acao === "chegada") toast.success(`Chegada registrada em ${parada.ponto_descricao}.`)
      else {
        const tempo = atualizado.paradas.find((p) => p.id === parada.id)?.tempo_parado_min
        toast.success(`Saída registrada. Tempo parado: ${formatMin(tempo)}.`)
      }
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })

  if (!passo) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900">
        <CheckCircle2 className="size-6 shrink-0" />
        <div>
          <p className="font-medium">Roteiro concluído</p>
          <p className="text-sm">
            Tempo total parado: <strong>{formatMin(roteiro.tempo_total_parado_min)}</strong> (
            {formatPct(roteiro.percentual_jornada)} da jornada)
          </p>
        </div>
      </div>
    )
  }

  const { parada, acao } = passo
  const config = parada.eh_partida
    ? { rotulo: "Iniciar roteiro", icone: Play, dica: "Registre a saída do ponto de partida. A partida não conta tempo parado." }
    : acao === "chegada"
      ? { rotulo: "Cheguei", icone: LogIn, dica: "Toque ao chegar no ponto. O cronômetro de parada começa agora." }
      : { rotulo: "Saí", icone: LogOut, dica: "Toque ao sair do ponto para registrar o tempo parado." }
  const Icone = config.icone

  return (
    <div className={cn("rounded-xl border-2 p-4", acao === "saida" && !parada.eh_partida ? "border-amber-300 bg-amber-50" : "border-primary/30 bg-primary/5")}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {parada.eh_partida ? "Ponto de partida" : `Ponto ${parada.ordem} de ${roteiro.paradas.length}`}
      </p>
      <p className="mt-1 text-lg font-semibold">{parada.ponto_descricao}</p>
      <a href={linkNavegacao(parada)} target="_blank" rel="noreferrer" className="mt-0.5 flex items-start gap-1 text-sm text-primary hover:underline">
        <MapPin className="mt-0.5 size-3.5 shrink-0" />
        {parada.endereco}
      </a>

      {acao === "saida" && parada.chegada_em && (
        <p className="mt-3 flex items-center gap-2 text-amber-900">
          <Clock className="size-4" />
          Parado há <strong className="text-xl"><Cronometro desde={parada.chegada_em} /></strong>
          <span className="text-sm">(desde {formatHora(parada.chegada_em)})</span>
        </p>
      )}

      <Button
        size="lg"
        className="mt-4 h-14 w-full text-base"
        onClick={() => registrar.mutate(passo)}
        disabled={registrar.isPending}
      >
        {registrar.isPending ? <Spinner className="size-5" /> : <Icone className="size-5" />}
        {config.rotulo}
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">{config.dica}</p>
    </div>
  )
}

function LinhaDoTempo({ roteiro }: { roteiro: RoteiroDetalhe }) {
  const atual = proximoPasso(roteiro)?.parada.id
  return (
    <ol className="relative grid grid-cols-1">
      {roteiro.paradas.map((p, i) => {
        const feito = p.eh_partida ? !!p.saida_em : !!p.saida_em
        const emCurso = p.id === atual
        return (
          <li key={p.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < roteiro.paradas.length - 1 && (
              <span className={cn("absolute top-7 left-3.5 h-[calc(100%-1.5rem)] w-px", feito ? "bg-emerald-300" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                feito && "border-emerald-500 bg-emerald-500 text-white",
                emCurso && !feito && "border-primary bg-primary text-primary-foreground",
                !feito && !emCurso && "bg-background text-muted-foreground",
              )}
            >
              {p.eh_partida ? <Flag className="size-3.5" /> : p.ordem}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={cn("truncate text-sm font-medium", !feito && !emCurso && "text-muted-foreground")}>
                  {p.ponto_descricao}
                </p>
                {!p.eh_partida && p.tempo_parado_min != null && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMin(p.tempo_parado_min)}</span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{p.endereco}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {p.eh_partida
                  ? `Partida ${p.saida_em ? `às ${formatHora(p.saida_em)}` : "pendente"} · não conta tempo`
                  : `Chegada ${formatHora(p.chegada_em)} · Saída ${formatHora(p.saida_em)}`}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function CartaoRoteiro({ roteiro, mostrarMotorista }: { roteiro: RoteiroDetalhe; mostrarMotorista: boolean }) {
  const concluidos = roteiro.paradas.filter((p) => !p.eh_partida && p.saida_em).length
  const destinos = roteiro.paradas.length - 1
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">
              <Link to={`/roteiros/${roteiro.id}`} className="hover:underline">
                {roteiro.nome || `Roteiro #${roteiro.id}`}
              </Link>
            </CardTitle>
            <CardDescription>
              {mostrarMotorista && <>{roteiro.motorista_nome} · </>}
              {concluidos} de {destinos} pontos · parado {formatMin(roteiro.tempo_total_parado_min)}
            </CardDescription>
          </div>
          <StatusBadge status={roteiro.status} />
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${destinos ? (concluidos / destinos) * 100 : 0}%` }} />
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5">
        <PainelAcao roteiro={roteiro} />
        <LinhaDoTempo roteiro={roteiro} />
      </CardContent>
    </Card>
  )
}

export default function Coleta() {
  const { usuario } = useAuth()
  const ehMotorista = usuario?.perfil === "MOTORISTA"
  const [data, setData] = useState(hojeIso())

  const { data: roteiros, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["coleta", data],
    queryFn: async () => (await api.get<RoteiroDetalhe[]>("/coleta/hoje", { params: { data } })).data,
    refetchInterval: ehMotorista ? false : 30_000,
  })

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        titulo={ehMotorista ? "Minha rota" : "Coleta do dia"}
        descricao={formatDataExtenso(data)}
        acoes={
          <>
            {!ehMotorista && (
              <Input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} className="w-40" />
            )}
            <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Atualizar" disabled={isFetching}>
              <RefreshCw className={cn(isFetching && "animate-spin")} />
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Carregando linhas={6} />
      ) : isError ? (
        <ErroCarregamento />
      ) : !roteiros?.length ? (
        <Vazio
          icone={Navigation}
          titulo="Nenhum roteiro para este dia"
          descricao={ehMotorista ? "Quando o gerente montar o seu roteiro do dia, ele aparecerá aqui." : "Monte um roteiro para a equipe na tela de Roteiros."}
          acao={!ehMotorista && <Button asChild><Link to="/roteiros/novo">Montar roteiro</Link></Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {roteiros.map((r) => (
            <CartaoRoteiro key={r.id} roteiro={r} mostrarMotorista={!ehMotorista} />
          ))}
        </div>
      )}
    </div>
  )
}
