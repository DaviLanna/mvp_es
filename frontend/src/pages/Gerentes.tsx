import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2, UserCog } from "lucide-react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useGerentes } from "@/hooks/queries"
import { api, mensagemErro } from "@/lib/api"
import { campoEmail, textoOuNull } from "@/lib/form"
import type { Gerente } from "@/lib/types"

const CARGOS = ["Gerente", "Coordenador(a)", "Dono da transportadora"]

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  cargo: z.string().trim().min(2, "Informe o cargo").max(40),
  telefone: z.string().trim().max(30),
  email: campoEmail,
  senha: z.string().refine((v) => v === "" || v.length >= 6, "Senha com pelo menos 6 caracteres"),
})
type Form = z.infer<typeof schema>

function GerenteDialog({ gerente, onClose }: { gerente: Gerente | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: gerente?.nome ?? "",
      cargo: gerente?.cargo ?? "Gerente",
      telefone: gerente?.telefone ?? "",
      email: gerente?.email ?? "",
      senha: "",
    },
  })
  const erros = form.formState.errors
  const salvar = useMutation({
    mutationFn: async (v: Form) => {
      const corpo = { nome: v.nome, cargo: v.cargo, telefone: textoOuNull(v.telefone), email: v.email }
      if (gerente) await api.put(`/gerentes/${gerente.id}`, corpo)
      else await api.post("/gerentes", { ...corpo, senha: v.senha || null })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gerentes"] })
      toast.success(gerente ? "Gerente atualizado." : "Gerente cadastrado.")
      onClose()
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{gerente ? "Editar gerente" : "Novo gerente / coordenador"}</DialogTitle>
          <DialogDescription>Responsável por uma equipe de motoristas.</DialogDescription>
        </DialogHeader>
        <form id="form-gerente" className="grid gap-4" onSubmit={form.handleSubmit((v) => salvar.mutate(v))} noValidate>
          <Campo label="Nome" htmlFor="nome" erro={erros.nome?.message}>
            <Input id="nome" {...form.register("nome")} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Cargo" htmlFor="cargo" erro={erros.cargo?.message}>
              <Input id="cargo" list="cargos" {...form.register("cargo")} />
              <datalist id="cargos">
                {CARGOS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Campo>
            <Campo label="Telefone" htmlFor="telefone" erro={erros.telefone?.message}>
              <Input id="telefone" {...form.register("telefone")} />
            </Campo>
          </div>
          <Campo label="E-mail" htmlFor="email" erro={erros.email?.message} ajuda={gerente?.usuario_id ? "Também é o login de acesso." : undefined}>
            <Input id="email" type="email" {...form.register("email")} />
          </Campo>
          {!gerente && (
            <Campo label="Senha de acesso (opcional)" htmlFor="senha" erro={erros.senha?.message} ajuda="Informe para criar o login com o e-mail acima.">
              <Input id="senha" type="password" autoComplete="new-password" {...form.register("senha")} />
            </Campo>
          )}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-gerente" disabled={salvar.isPending}>
            {salvar.isPending && <Spinner />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Gerentes() {
  const queryClient = useQueryClient()
  const { data: gerentes, isLoading, isError } = useGerentes()
  const [editando, setEditando] = useState<Gerente | null | undefined>(undefined)
  const excluir = useMutation({
    mutationFn: (id: number) => api.delete(`/gerentes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gerentes"] })
      queryClient.invalidateQueries({ queryKey: ["motoristas"] })
      toast.success("Gerente removido.")
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })

  return (
    <>
      <PageHeader
        titulo="Gerentes / coordenadores"
        descricao="Gerentes, coordenadores e donos de transportadora com suas equipes."
        acoes={
          <Button onClick={() => setEditando(null)}>
            <Plus />
            Novo gerente
          </Button>
        }
      />
      {isLoading ? (
        <Carregando />
      ) : isError ? (
        <ErroCarregamento />
      ) : !gerentes?.length ? (
        <Vazio icone={UserCog} titulo="Nenhum gerente cadastrado" />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="text-right">Equipe</TableHead>
                  <TableHead>Acesso</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {gerentes.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.nome}</TableCell>
                    <TableCell>{g.cargo}</TableCell>
                    <TableCell className="tabular-nums">{g.telefone ?? "—"}</TableCell>
                    <TableCell>{g.email}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.qtd_motoristas} motorista(s)</TableCell>
                    <TableCell>{g.usuario_id ? <Badge variant="secondary">Com login</Badge> : <Badge variant="outline">Sem login</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditando(g)} aria-label="Editar">
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
                              <AlertDialogTitle>Excluir {g.nome}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Os motoristas da equipe ficarão sem gerente e o login do gerente será desativado.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => excluir.mutate(g.id)}>
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
      {editando !== undefined && <GerenteDialog gerente={editando} onClose={() => setEditando(undefined)} />}
    </>
  )
}
