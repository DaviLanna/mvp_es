import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Calculator, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Campo, Carregando, ErroCarregamento, PageHeader, Spinner } from "@/components/comum"
import { FiltroPeriodo } from "@/components/filtros"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useParametros } from "@/hooks/queries"
import { api, mensagemErro } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { campoNumero, parseNumero } from "@/lib/form"
import { diasAtrasIso, formatDataHora, formatMoeda, hojeIso } from "@/lib/format"
import type { Parametros as TParametros } from "@/lib/types"

const schema = z.object({
  valor_combustivel_litro: campoNumero({ obrigatorio: true, min: 0, maior: true }),
  km_por_litro_padrao: campoNumero({ obrigatorio: true, min: 0, maior: true }),
  custo_adicional_km: campoNumero({ obrigatorio: true, min: 0 }),
  jornada_padrao_horas: campoNumero({ obrigatorio: true, min: 0, maior: true }).refine((v) => parseNumero(v) <= 24, "Máximo 24 h"),
  tempo_minimo_parada_min: campoNumero({ obrigatorio: true, min: 0 }),
})
type Form = z.infer<typeof schema>
type NomeCampo = keyof Form

const paraForm = (p: TParametros): Form => ({
  valor_combustivel_litro: String(p.valor_combustivel_litro).replace(".", ","),
  km_por_litro_padrao: String(p.km_por_litro_padrao).replace(".", ","),
  custo_adicional_km: String(p.custo_adicional_km).replace(".", ","),
  jornada_padrao_horas: String(p.jornada_padrao_horas).replace(".", ","),
  tempo_minimo_parada_min: String(p.tempo_minimo_parada_min).replace(".", ","),
})

const REGRAS = [
  "O ponto de partida (ponto 1) não conta tempo parado; a contagem começa no segundo ponto.",
  "Tempo parado em um ponto = horário de saída − horário de chegada.",
  "Tempo total do roteiro = soma dos tempos parados de todos os pontos, exceto a partida.",
  "Percentual da jornada = tempo parado ÷ (dias trabalhados × jornada padrão).",
  "Custo por km = valor do combustível ÷ km/litro do veículo + custo adicional por km.",
  "Custo estimado do roteiro = distância percorrida × custo por km.",
]

export default function Parametros() {
  const queryClient = useQueryClient()
  const { temPerfil } = useAuth()
  const admin = temPerfil("ADMIN")
  const { data: parametros, isLoading, isError } = useParametros()
  const [periodo, setPeriodo] = useState({ inicio: diasAtrasIso(29), fim: hojeIso() })

  const form = useForm<Form>({ resolver: zodResolver(schema) })
  const erros = form.formState.errors
  useEffect(() => {
    if (parametros) form.reset(paraForm(parametros))
  }, [parametros, form])

  const salvar = useMutation({
    mutationFn: async (v: Form) =>
      (await api.put<TParametros>("/parametros", Object.fromEntries(Object.entries(v).map(([k, x]) => [k, parseNumero(x)])))).data,
    onSuccess: (p) => {
      queryClient.setQueryData(["parametros"], p)
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Parâmetros salvos. Novos cálculos já usam os valores atualizados.")
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })

  const recalcular = useMutation({
    mutationFn: async () => (await api.post<{ roteiros_recalculados: number }>("/parametros/recalcular", null, { params: periodo })).data,
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["roteiros"] })
      queryClient.invalidateQueries({ queryKey: ["roteiro"] })
      toast.success(`${r.roteiros_recalculados} roteiro(s) recalculado(s).`)
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })

  const valores = form.watch()
  const previa = (() => {
    const v = parseNumero(valores.valor_combustivel_litro ?? "")
    const kml = parseNumero(valores.km_por_litro_padrao ?? "")
    const adicional = parseNumero(valores.custo_adicional_km ?? "")
    return v > 0 && kml > 0 && adicional >= 0 ? v / kml + adicional : null
  })()

  if (isLoading) return <Carregando linhas={6} />
  if (isError || !parametros) return <ErroCarregamento />

  const campo = (nome: NomeCampo, rotulo: string, sufixo: string, ajuda?: string) => (
    <Campo label={rotulo} htmlFor={nome} erro={erros[nome]?.message} ajuda={ajuda}>
      <div className="relative">
        <Input id={nome} inputMode="decimal" disabled={!admin} className="pr-16" {...form.register(nome)} />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{sufixo}</span>
      </div>
    </Campo>
  )

  return (
    <>
      <PageHeader
        titulo="Parâmetros"
        descricao="Custos e regras de cálculo do tempo parado, alteráveis sem mudar o código."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <form onSubmit={form.handleSubmit((v) => salvar.mutate(v))} noValidate>
          <Card>
            <CardHeader>
              <CardTitle>Custos e jornada</CardTitle>
              <CardDescription>
                {admin ? "Somente administradores podem alterar." : "Visualização — somente administradores podem alterar."} Última
                alteração: {formatDataHora(parametros.atualizado_em)}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {campo("valor_combustivel_litro", "Valor do combustível", "R$/litro")}
              {campo("km_por_litro_padrao", "Rendimento padrão do veículo", "km/litro", "Usado quando o motorista não tem rendimento próprio.")}
              {campo("custo_adicional_km", "Custo adicional por km", "R$/km", "Manutenção, pneus, desgaste…")}
              <div className="flex flex-col justify-center rounded-lg bg-muted/60 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calculator className="size-3.5" /> Custo por km (padrão)
                </p>
                <p className="text-xl font-semibold tabular-nums">{previa != null ? formatMoeda(previa) : "—"}</p>
              </div>
              {campo("jornada_padrao_horas", "Jornada padrão de trabalho", "horas/dia", "Base percentual dos indicadores de tempo parado.")}
              {campo("tempo_minimo_parada_min", "Tempo mínimo de parada", "minutos", "Paradas mais curtas contam como 0 (use 0 para contar tudo).")}
            </CardContent>
            {admin && (
              <CardFooter className="justify-end border-t pt-4">
                <Button type="submit" disabled={salvar.isPending}>
                  {salvar.isPending && <Spinner />}
                  Salvar parâmetros
                </Button>
              </CardFooter>
            )}
          </Card>
        </form>

        <div className="grid h-fit gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Regras de cálculo</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid list-decimal gap-2 pl-5 text-sm text-muted-foreground">
                {REGRAS.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
          {admin && (
            <Card>
              <CardHeader>
                <CardTitle>Aplicar a roteiros anteriores</CardTitle>
                <CardDescription>
                  O custo de cada roteiro fica gravado com os parâmetros da época. Recalcule um período para aplicar os valores atuais.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-2">
                <FiltroPeriodo inicio={periodo.inicio} fim={periodo.fim} onChange={(inicio, fim) => setPeriodo({ inicio, fim })} />
                <Button variant="outline" onClick={() => recalcular.mutate()} disabled={recalcular.isPending}>
                  <RefreshCw className={recalcular.isPending ? "animate-spin" : undefined} />
                  Recalcular
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
