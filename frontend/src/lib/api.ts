import axios, { AxiosError } from "axios"

export const TOKEN_KEY = "tp.token"

export const api = axios.create({ baseURL: "/api" })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (resp) => resp,
  (error: AxiosError) => {
    const isLogin = error.config?.url?.includes("/auth/login")
    if (error.response?.status === 401 && !isLogin) {
      localStorage.removeItem(TOKEN_KEY)
      if (window.location.pathname !== "/login") window.location.assign("/login")
    }
    return Promise.reject(error)
  },
)

type DetalheValidacao = { loc?: (string | number)[]; msg: string }

/** Extrai uma mensagem legível de um erro da API (FastAPI devolve `detail`). */
export function mensagemErro(error: unknown, padrao = "Não foi possível concluir a operação."): string {
  if (error instanceof AxiosError) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail) && detail.length) {
      return (detail as DetalheValidacao[])
        .map((d) => {
          const campo = d.loc?.filter((p) => p !== "body").join(".")
          return campo ? `${campo}: ${d.msg}` : d.msg
        })
        .join("; ")
    }
    if (!error.response) return "Sem conexão com o servidor."
  }
  return padrao
}

/** Remove chaves vazias para montar query strings limpas. */
export function limparParams<T extends Record<string, unknown>>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ) as Partial<T>
}

/** Baixa um arquivo autenticado (ex.: CSV) e dispara o download no navegador. */
export async function baixarArquivo(url: string, params: Record<string, unknown>, nomePadrao: string) {
  const resp = await api.get<Blob>(url, { params: limparParams(params), responseType: "blob" })
  const disposicao = resp.headers["content-disposition"] as string | undefined
  const nome = disposicao?.match(/filename="?([^"]+)"?/)?.[1] ?? nomePadrao
  const href = URL.createObjectURL(resp.data)
  const link = document.createElement("a")
  link.href = href
  link.download = nome
  link.click()
  URL.revokeObjectURL(href)
}
