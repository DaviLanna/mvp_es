import { ChevronDownIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Ponto } from "@/lib/types"
import { cn } from "@/lib/utils"

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

/** Todos os termos digitados precisam aparecer no nome ou no endereço, sem diferenciar acentos. */
function filtrar(_valor: string, busca: string, palavras?: string[]) {
  const alvo = normalizar((palavras ?? []).join(" "))
  const termos = normalizar(busca).split(/\s+/).filter(Boolean)
  return termos.every((termo) => alvo.includes(termo)) ? 1 : 0
}

/** Combobox de pontos cadastrados: clique para listar ou digite para filtrar por nome/endereço. */
export function SeletorPonto({
  pontos,
  valor,
  onChange,
  placeholder = "Escolha um ponto cadastrado",
  className,
}: {
  pontos: Ponto[] | undefined
  valor: string
  onChange: (valor: string) => void
  placeholder?: string
  className?: string
}) {
  const [aberto, setAberto] = useState(false)
  const selecionado = pontos?.find((p) => String(p.id) === valor)

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          className={cn(
            "w-full min-w-0 flex-1 justify-between px-2.5 font-normal",
            !selecionado && "text-muted-foreground",
            className,
          )}
        >
          <span className="min-w-0 truncate">
            {selecionado ? `${selecionado.descricao} — ${selecionado.endereco}` : placeholder}
          </span>
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-[min(36rem,calc(100vw-2rem))] p-0">
        <Command filter={filtrar}>
          <CommandInput placeholder="Buscar por nome ou endereço…" />
          <CommandList>
            <CommandEmpty>Nenhum ponto encontrado.</CommandEmpty>
            {pontos?.map((p) => (
              <CommandItem
                key={p.id}
                value={String(p.id)}
                keywords={[p.descricao, p.endereco]}
                data-checked={String(p.id) === valor}
                onSelect={(id) => {
                  onChange(id)
                  setAberto(false)
                }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium break-words">{p.descricao}</span>
                  <span className="text-xs break-words text-muted-foreground">{p.endereco}</span>
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
