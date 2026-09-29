import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMotoristas } from "@/hooks/queries"
import { useAuth } from "@/lib/auth"

const TODOS = "todos"

/** Select de motorista (apenas para gestores). `valor` vazio = todos. */
export function FiltroMotorista({
  valor,
  onChange,
  className,
}: {
  valor: string
  onChange: (valor: string) => void
  className?: string
}) {
  const { temPerfil } = useAuth()
  const { data: motoristas } = useMotoristas()
  if (!temPerfil("ADMIN", "GERENTE")) return null
  return (
    <div className={className}>
      <Label className="mb-1.5 text-xs text-muted-foreground">Motorista</Label>
      <Select value={valor || TODOS} onValueChange={(v) => onChange(v === TODOS ? "" : v)}>
        <SelectTrigger className="w-full sm:w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os motoristas</SelectItem>
          {motoristas?.map((m) => (
            <SelectItem key={m.id} value={String(m.id)}>
              {m.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function FiltroPeriodo({
  inicio,
  fim,
  onChange,
}: {
  inicio: string
  fim: string
  onChange: (inicio: string, fim: string) => void
}) {
  return (
    <div className="flex items-end gap-2">
      <div>
        <Label htmlFor="f-inicio" className="mb-1.5 text-xs text-muted-foreground">
          De
        </Label>
        <Input id="f-inicio" type="date" value={inicio} max={fim} onChange={(e) => e.target.value && onChange(e.target.value, fim)} />
      </div>
      <div>
        <Label htmlFor="f-fim" className="mb-1.5 text-xs text-muted-foreground">
          Até
        </Label>
        <Input id="f-fim" type="date" value={fim} min={inicio} onChange={(e) => e.target.value && onChange(inicio, e.target.value)} />
      </div>
    </div>
  )
}
