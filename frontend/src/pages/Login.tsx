import { zodResolver } from "@hookform/resolvers/zod"
import { ClipboardList, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Navigate, useNavigate } from "react-router"
import { z } from "zod"

import { Campo, Spinner } from "@/components/comum"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { mensagemErro } from "@/lib/api"
import { rotaInicial, useAuth } from "@/lib/auth"
import { APP_NAME } from "@/lib/format"

const schema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail"),
  senha: z.string().min(1, "Informe a senha"),
})
type Form = z.infer<typeof schema>

const ACESSOS_DEMO = [
  { perfil: "Administrador", email: "admin@mvp.local", senha: "admin123" },
  { perfil: "Gerente", email: "gerente@mvp.local", senha: "gerente123" },
  { perfil: "Motorista", email: "joao@mvp.local", senha: "motorista123" },
]

export default function Login() {
  const { usuario, entrar } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: "", senha: "" } })

  if (usuario) return <Navigate to={rotaInicial(usuario.perfil)} replace />

  const onSubmit = form.handleSubmit(async ({ email, senha }) => {
    setErro(null)
    try {
      const u = await entrar(email, senha)
      navigate(rotaInicial(u.perfil), { replace: true })
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível entrar."))
    }
  })

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ClipboardList className="size-5" />
          </div>
          <h1 className="text-xl font-semibold">{APP_NAME}</h1>
          <p className="text-sm text-muted-foreground">Monitoramento de tempo parado em roteiros</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Use o e-mail e a senha cadastrados.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              <Campo label="E-mail" htmlFor="email" erro={form.formState.errors.email?.message}>
                <Input id="email" type="email" autoComplete="username" autoFocus {...form.register("email")} />
              </Campo>
              <Campo label="Senha" htmlFor="senha" erro={form.formState.errors.senha?.message}>
                <Input id="senha" type="password" autoComplete="current-password" {...form.register("senha")} />
              </Campo>
              {erro && (
                <Alert variant="destructive">
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner />}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 rounded-xl border bg-background p-3 text-xs text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Acessos de demonstração</p>
          <ul className="grid gap-1">
            {ACESSOS_DEMO.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  className="text-left hover:text-foreground hover:underline"
                  onClick={() => {
                    form.setValue("email", a.email)
                    form.setValue("senha", a.senha)
                  }}
                >
                  <span className="font-medium">{a.perfil}:</span> {a.email} / {a.senha}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 flex gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Aviso de privacidade (LGPD): coletamos nome, contato, documento, horários e localização nos pontos do
            roteiro apenas para medir o tempo parado e calcular custos operacionais. Os dados são acessados
            somente por perfis autorizados, e as alterações ficam registradas em auditoria.
          </span>
        </p>
      </div>
    </div>
  )
}
