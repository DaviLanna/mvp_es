import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { EyeOff, Pencil, Plus, UsersRound } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useGerentes, useMotoristas } from "@/hooks/queries"
import { api, mensagemErro } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { campoNumero, numeroOuNull, textoOuNull } from "@/lib/form"
import { formatNumero } from "@/lib/format"
import type { Motorista } from "@/lib/types"

const SEM_GERENTE = "nenhum"

const schema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome"),
    telefone: z.string().trim().max(30),
    documento: z.string().trim().max(30),
    veiculo: z.string().trim().min(2, "Informe o veículo"),
    placa: z.string().trim().max(10),
    km_por_litro: campoNumero({ min: 0, maior: true }),
    gerente_id: z.string(),
    ativo: z.boolean(),
    email: z.string().trim(),
    senha: z.string(),
  })
  .refine((v) => !v.email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email), { path: ["email"], message: "E-mail inválido" })
  .refine((v) => !v.email || v.senha.length >= 6, { path: ["senha"], message: "Senha com pelo menos 6 caracteres" })
  .refine((v) => !v.senha || v.email, { path: ["email"], message: "Informe o e-mail de acesso" })
type Form = z.infer<typeof schema>

function MotoristaDialog({ motorista, onClose }: { motorista: Motorista | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { temPerfil } = useAuth()
  const admin = temPerfil("ADMIN")
  const { data: gerentes } = useGerentes(admin)
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: motorista?.nome ?? "",
      telefone: motorista?.telefone ?? "",
      documento: admin ? (motorista?.documento ?? "") : "",
      veiculo: motorista?.veiculo ?? "",
      placa: motorista?.placa ?? "",
      km_por_litro: motorista?.km_por_litro?.toString() ?? "",
      gerente_id: motorista?.gerente_id ? String(motorista.gerente_id) : SEM_GERENTE,
      ativo: motorista?.ativo ?? true,
      email: "",
      senha: "",
    },
  })
  const erros = form.formState.errors

  const salvar = useMutation({
    mutationFn: async (v: Form) => {
      const corpo: Record<string, unknown> = {
        nome: v.nome,
        telefone: textoOuNull(v.telefone),
        veiculo: v.veiculo,
        placa: textoOuNull(v.placa)?.toUpperCase() ?? null,
        km_por_litro: numeroOuNull(v.km_por_litro),
      }
      // Gerente vê o documento mascarado: só envia se foi digitado um novo valor
      if (admin || v.documento) corpo.documento = textoOuNull(v.documento)
      if (admin) corpo.gerente_id = v.gerente_id === SEM_GERENTE ? null : Number(v.gerente_id)
      if (motorista) return api.put(`/motoristas/${motorista.id}`, { ...corpo, ativo: v.ativo })
      return api.post("/motoristas", { ...corpo, email: textoOuNull(v.email), senha: v.senha || null })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motoristas"] })
      queryClient.invalidateQueries({ queryKey: ["gerentes"] })
      toast.success(motorista ? "Motorista atualizado." : "Motorista cadastrado.")
      onClose()
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{motorista ? "Editar motorista" : "Novo motorista / motoboy"}</DialogTitle>
          <DialogDescription>Dados pessoais tratados conforme a LGPD, usados só para a operação.</DialogDescription>
        </DialogHeader>
        <form id="form-motorista" className="grid gap-4" onSubmit={form.handleSubmit((v) => salvar.mutate(v))} noValidate>
          <Campo label="Nome" htmlFor="nome" erro={erros.nome?.message}>
            <Input id="nome" {...form.register("nome")} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Telefone" htmlFor="telefone" erro={erros.telefone?.message}>
              <Input id="telefone" placeholder="(31) 90000-0000" {...form.register("telefone")} />
            </Campo>
            <Campo
              label="Documento (CPF/CNH)"
              htmlFor="documento"
              erro={erros.documento?.message}
              ajuda={!admin && motorista?.documento ? `Atual: ${motorista.documento}` : undefined}
            >
              <Input id="documento" placeholder={!admin && motorista ? "Manter atual" : ""} {...form.register("documento")} />
            </Campo>
          </div>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Campo label="Veículo" htmlFor="veiculo" erro={erros.veiculo?.message}>
              <Input id="veiculo" placeholder="Ex.: Moto Honda CG 160" {...form.register("veiculo")} />
            </Campo>
            <Campo label="Placa" htmlFor="placa" erro={erros.placa?.message}>
              <Input id="placa" className="uppercase" {...form.register("placa")} />
            </Campo>
          </div>
          <Campo label="Rendimento (km/litro)" htmlFor="kml" erro={erros.km_por_litro?.message} ajuda="Em branco usa o rendimento padrão dos parâmetros.">
            <Input id="kml" inputMode="decimal" placeholder="Ex.: 35" {...form.register("km_por_litro")} />
          </Campo>
          {admin && (
            <Campo label="Gerente responsável (equipe)">
              <Controller
                control={form.control}
                name="gerente_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_GERENTE}>Sem gerente</SelectItem>
                      {gerentes?.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.nome} · {g.cargo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>
          )}
          {motorista ? (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.watch("ativo")} onCheckedChange={(v) => form.setValue("ativo", v)} />
              Ativo (inativos não recebem roteiros nem acessam o sistema)
            </label>
          ) : (
            <>
              <Separator />
              <p className="-mb-2 text-sm font-medium">Acesso ao sistema (opcional)</p>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="E-mail" htmlFor="email" erro={erros.email?.message}>
                  <Input id="email" type="email" {...form.register("email")} />
                </Campo>
                <Campo label="Senha inicial" htmlFor="senha" erro={erros.senha?.message}>
                  <Input id="senha" type="password" autoComplete="new-password" {...form.register("senha")} />
                </Campo>
              </div>
            </>
          )}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-motorista" disabled={salvar.isPending}>
            {salvar.isPending && <Spinner />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Motoristas() {
  const queryClient = useQueryClient()
  const { temPerfil } = useAuth()
  const admin = temPerfil("ADMIN")
  const { data: motoristas, isLoading, isError } = useMotoristas()
  const [editando, setEditando] = useState<Motorista | null | undefined>(undefined)

  const anonimizar = useMutation({
    mutationFn: (id: number) => api.post(`/motoristas/${id}/anonimizar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motoristas"] })
      toast.success("Dados pessoais removidos. Os roteiros foram mantidos para estatística.")
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })

  return (
    <>
      <PageHeader
        titulo="Motoristas / motoboys"
        descricao={admin ? "Todos os profissionais de campo." : "Profissionais de campo da sua equipe."}
        acoes={
          <Button onClick={() => setEditando(null)}>
            <Plus />
            Novo motorista
          </Button>
        }
      />
      {isLoading ? (
        <Carregando />
      ) : isError ? (
        <ErroCarregamento />
      ) : !motoristas?.length ? (
        <Vazio icone={UsersRound} titulo="Nenhum motorista cadastrado" />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead className="text-right">km/l</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Documento</TableHead>
                  {admin && <TableHead>Gerente</TableHead>}
                  <TableHead>Acesso</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {motoristas.map((m) => (
                  <TableRow key={m.id} className={!m.ativo ? "text-muted-foreground" : undefined}>
                    <TableCell className="font-medium">
                      {m.nome}
                      {!m.ativo && (
                        <Badge variant="outline" className="ml-2">
                          {m.anonimizado_em ? "Anonimizado" : "Inativo"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.veiculo}
                      {m.placa && <span className="block text-xs text-muted-foreground">{m.placa}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumero(m.km_por_litro)}</TableCell>
                    <TableCell className="tabular-nums">{m.telefone ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{m.documento ?? "—"}</TableCell>
                    {admin && <TableCell>{m.gerente_nome ?? "—"}</TableCell>}
                    <TableCell className="text-xs">{m.email_acesso ?? <span className="text-muted-foreground">sem acesso</span>}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        {!m.anonimizado_em && (
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditando(m)} aria-label="Editar">
                            <Pencil />
                          </Button>
                        )}
                        {admin && !m.anonimizado_em && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Anonimizar (LGPD)" title="Anonimizar (LGPD)">
                                <EyeOff />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Anonimizar {m.nome}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Atende a pedidos de eliminação de dados (LGPD). Nome, telefone, documento e placa serão apagados e o acesso
                                  desativado. Os roteiros e tempos continuam no histórico, sem identificação pessoal. Não pode ser desfeito.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction variant="destructive" onClick={() => anonimizar.mutate(m.id)}>
                                  Anonimizar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {editando !== undefined && <MotoristaDialog motorista={editando} onClose={() => setEditando(undefined)} />}
    </>
  )
}
