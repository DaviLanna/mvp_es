import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Campo, Carregando, ErroCarregamento, PageHeader, Spinner, Vazio } from "@/components/comum"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { usePontos } from "@/hooks/queries"
import { api, mensagemErro } from "@/lib/api"
import { campoNumero, numeroOuNull } from "@/lib/form"
import type { GeocodeResultado, Ponto } from "@/lib/types"

const schema = z.object({
  descricao: z.string().trim().min(1, "Informe uma descrição"),
  endereco: z.string().trim().min(3, "Informe o endereço"),
  latitude: campoNumero({ min: -90 }).refine((v) => v === "" || Number(v.replace(",", ".")) <= 90, "Latitude entre -90 e 90"),
  longitude: campoNumero({ min: -180 }).refine((v) => v === "" || Number(v.replace(",", ".")) <= 180, "Longitude entre -180 e 180"),
  ativo: z.boolean(),
})
type Form = z.infer<typeof schema>

function PontoDialog({ ponto, onClose }: { ponto: Ponto | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [resultados, setResultados] = useState<GeocodeResultado[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      descricao: ponto?.descricao ?? "",
      endereco: ponto?.endereco ?? "",
      latitude: ponto?.latitude?.toString() ?? "",
      longitude: ponto?.longitude?.toString() ?? "",
      ativo: ponto?.ativo ?? true,
    },
  })
  const erros = form.formState.errors

  const salvar = useMutation({
    mutationFn: async (v: Form) => {
      const corpo = {
        descricao: v.descricao,
        endereco: v.endereco,
        latitude: numeroOuNull(v.latitude),
        longitude: numeroOuNull(v.longitude),
        ...(ponto ? { ativo: v.ativo } : {}),
      }
      return ponto ? api.put(`/pontos/${ponto.id}`, corpo) : api.post("/pontos", corpo)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pontos"] })
      toast.success(ponto ? "Ponto atualizado." : "Ponto cadastrado.")
      onClose()
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })

  const buscarCoordenadas = async () => {
    const endereco = form.getValues("endereco").trim()
    if (endereco.length < 3) {
      form.setError("endereco", { message: "Digite o endereço para buscar" })
      return
    }
    setBuscando(true)
    try {
      const { data } = await api.get<GeocodeResultado[]>("/pontos/geocode", { params: { q: endereco } })
      setResultados(data)
      if (!data.length) toast.info("Nenhum resultado. Tente incluir bairro e cidade.")
    } catch (e) {
      toast.error(mensagemErro(e, "Falha ao buscar coordenadas."))
    } finally {
      setBuscando(false)
    }
  }

  const escolher = (r: GeocodeResultado) => {
    form.setValue("latitude", r.latitude.toFixed(6), { shouldValidate: true })
    form.setValue("longitude", r.longitude.toFixed(6), { shouldValidate: true })
    setResultados(null)
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ponto ? "Editar ponto" : "Novo ponto"}</DialogTitle>
          <DialogDescription>Endereço e coordenadas usados nos roteiros e no cálculo da distância.</DialogDescription>
        </DialogHeader>
        <form id="form-ponto" className="grid gap-4" onSubmit={form.handleSubmit((v) => salvar.mutate(v))} noValidate>
          <Campo label="Descrição" htmlFor="descricao" erro={erros.descricao?.message}>
            <Input id="descricao" placeholder="Ex.: Cliente Rua Peru" {...form.register("descricao")} />
          </Campo>
          <Campo label="Endereço" htmlFor="endereco" erro={erros.endereco?.message}>
            <div className="flex gap-2">
              <Input id="endereco" placeholder="Rua, número - bairro, cidade - UF" {...form.register("endereco")} />
              <Button type="button" variant="secondary" onClick={buscarCoordenadas} disabled={buscando} title="Buscar coordenadas (OpenStreetMap)">
                {buscando ? <Spinner /> : <Search />}
                <span className="hidden sm:inline">Coordenadas</span>
              </Button>
            </div>
          </Campo>
          {resultados && resultados.length > 0 && (
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border p-1">
              {resultados.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => escolher(r)}
                  className="flex items-start gap-2 rounded-md p-2 text-left text-xs hover:bg-muted"
                >
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    {r.endereco}
                    <span className="block text-muted-foreground">
                      {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Latitude" htmlFor="lat" erro={erros.latitude?.message}>
              <Input id="lat" inputMode="decimal" placeholder="-19.9191" {...form.register("latitude")} />
            </Campo>
            <Campo label="Longitude" htmlFor="lng" erro={erros.longitude?.message}>
              <Input id="lng" inputMode="decimal" placeholder="-43.9386" {...form.register("longitude")} />
            </Campo>
          </div>
          {ponto && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.watch("ativo")} onCheckedChange={(v) => form.setValue("ativo", v)} />
              Ponto ativo (disponível para novos roteiros)
            </label>
          )}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-ponto" disabled={salvar.isPending}>
            {salvar.isPending && <Spinner />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Pontos() {
  const queryClient = useQueryClient()
  const { data: pontos, isLoading, isError } = usePontos()
  const [filtro, setFiltro] = useState("")
  const [editando, setEditando] = useState<Ponto | null | undefined>(undefined)

  const excluir = useMutation({
    mutationFn: (id: number) => api.delete(`/pontos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pontos"] })
      toast.success("Ponto removido (ou desativado, se já usado em roteiros).")
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })

  const termo = filtro.trim().toLowerCase()
  const lista = pontos?.filter((p) => !termo || `${p.descricao} ${p.endereco}`.toLowerCase().includes(termo)) ?? []

  return (
    <>
      <PageHeader
        titulo="Pontos"
        descricao="Endereços com coordenadas que compõem os roteiros (clientes, bases, pedidos)."
        acoes={
          <Button onClick={() => setEditando(null)}>
            <Plus />
            Novo ponto
          </Button>
        }
      />
      <div className="mb-4">
        <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por descrição ou endereço" className="max-w-sm" />
      </div>

      {isLoading ? (
        <Carregando />
      ) : isError ? (
        <ErroCarregamento />
      ) : !lista.length ? (
        <Vazio icone={MapPin} titulo="Nenhum ponto encontrado" />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Coordenadas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.descricao}</TableCell>
                    <TableCell className="max-w-80 truncate">{p.endereco}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {p.latitude != null && p.longitude != null ? (
                        <a href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer" className="hover:underline">
                          {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                        </a>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="size-3.5" /> sem coordenadas
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{p.ativo ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditando(p)} aria-label="Editar">
                          <Pencil />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Excluir">
                              <Trash2 />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir "{p.descricao}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se o ponto já foi usado em algum roteiro ele será apenas desativado, para preservar o histórico.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => excluir.mutate(p.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {editando !== undefined && <PontoDialog ponto={editando} onClose={() => setEditando(undefined)} />}
    </>
  )
}
