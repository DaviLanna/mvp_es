import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Campo, Carregando, ErroCarregamento, PageHeader, Spinner } from "@/components/comum"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, mensagemErro } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { campoEmail } from "@/lib/form"
import { PERFIL_LABEL } from "@/lib/format"
import type { Usuario } from "@/lib/types"

const schemaNovo = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: campoEmail,
  senha: z.string().min(6, "Pelo menos 6 caracteres"),
})

function NovoAdminDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm<z.infer<typeof schemaNovo>>({ resolver: zodResolver(schemaNovo), defaultValues: { nome: "", email: "", senha: "" } })
  const erros = form.formState.errors
  const salvar = useMutation({
    mutationFn: (v: z.infer<typeof schemaNovo>) => api.post("/usuarios", { ...v, perfil: "ADMIN" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] })
      toast.success("Administrador criado.")
      onClose()
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo administrador</DialogTitle>
          <DialogDescription>Logins de gerentes e motoristas são criados nos respectivos cadastros.</DialogDescription>
        </DialogHeader>
        <form id="form-admin" className="grid gap-4" onSubmit={form.handleSubmit((v) => salvar.mutate(v))} noValidate>
          <Campo label="Nome" htmlFor="nome" erro={erros.nome?.message}>
            <Input id="nome" {...form.register("nome")} />
          </Campo>
          <Campo label="E-mail" htmlFor="email" erro={erros.email?.message}>
            <Input id="email" type="email" {...form.register("email")} />
          </Campo>
          <Campo label="Senha" htmlFor="senha" erro={erros.senha?.message}>
            <Input id="senha" type="password" autoComplete="new-password" {...form.register("senha")} />
          </Campo>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-admin" disabled={salvar.isPending}>
            {salvar.isPending && <Spinner />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SenhaDialog({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const [senha, setSenha] = useState("")
  const salvar = useMutation({
    mutationFn: () => api.patch(`/usuarios/${usuario.id}`, { senha }),
    onSuccess: () => {
      toast.success(`Senha de ${usuario.nome} redefinida.`)
      onClose()
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>{usuario.email}</DialogDescription>
        </DialogHeader>
        <Campo label="Nova senha" htmlFor="nova-senha" erro={senha && senha.length < 6 ? "Pelo menos 6 caracteres" : undefined}>
          <Input id="nova-senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={senha.length < 6 || salvar.isPending}>
            {salvar.isPending && <Spinner />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Usuarios() {
  const queryClient = useQueryClient()
  const { usuario: eu } = useAuth()
  const [novo, setNovo] = useState(false)
  const [senhaDe, setSenhaDe] = useState<Usuario | null>(null)
  const { data: usuarios, isLoading, isError } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => (await api.get<Usuario[]>("/usuarios")).data,
  })
  const alternar = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) => api.patch(`/usuarios/${id}`, { ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
    onError: (e) => toast.error(mensagemErro(e)),
  })

  return (
    <>
      <PageHeader
        titulo="Usuários"
        descricao="Acessos por perfil: administrador, gerente/coordenador e motorista/motoboy."
        acoes={
          <Button onClick={() => setNovo(true)}>
            <Plus />
            Novo administrador
          </Button>
        }
      />
      {isLoading ? (
        <Carregando />
      ) : isError || !usuarios ? (
        <ErroCarregamento />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nome}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.perfil === "ADMIN" ? "default" : "secondary"}>{PERFIL_LABEL[u.perfil]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.ativo}
                        disabled={u.id === eu?.id || alternar.isPending}
                        onCheckedChange={(ativo) => alternar.mutate({ id: u.id, ativo })}
                        aria-label="Ativar ou desativar acesso"
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => setSenhaDe(u)} aria-label="Redefinir senha" title="Redefinir senha">
                        <KeyRound />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {novo && <NovoAdminDialog onClose={() => setNovo(false)} />}
      {senhaDe && <SenhaDialog usuario={senhaDe} onClose={() => setSenhaDe(null)} />}
    </>
  )
}
