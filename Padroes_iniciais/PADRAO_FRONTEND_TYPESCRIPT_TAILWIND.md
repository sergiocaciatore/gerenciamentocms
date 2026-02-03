# Padrão Frontend (TypeScript + React + Tailwind)

## 1. Objetivo

Definir padrões de implementação, organização e qualidade do frontend usando **TypeScript**, **React** e **TailwindCSS**, garantindo consistência, segurança, acessibilidade e escalabilidade.

## 2. Escopo

Aplica-se a:

- Componentes UI, páginas, layouts, hooks, serviços (API), estados e validações.
- Estilização via Tailwind e design system (tokens/classes utilitárias).
- Testes, lint/format e pipeline de qualidade.

Não cobre backend, IaC e infraestrutura.

## 3. Stack de Referência

- TypeScript (strict)
- React + (Router conforme projeto: Next.js / React Router)
- TailwindCSS
- ESLint + Prettier
- Testes: Vitest/Jest + Testing Library
- Tipagem/validação: Zod (preferencial)

## 4. Estrutura de Pastas (referência)

Exemplo (ajuste ao framework):

```
src/
  app/                 # rotas/páginas (se Next, pode ser app/ no root)
  pages/               # (se React Router, pode ser pages/ + routes/)
  components/
    ui/                # componentes genéricos (Button, Modal, Input)
    shared/            # componentes reutilizáveis com regra leve
    feature/           # componentes por feature (mais acoplados)
  features/
    billing/
      components/
      hooks/
      services/
      schemas/
      types.ts
      index.ts
  hooks/
  services/
    http/
    api/
  lib/
    utils/
    constants/
  styles/
  assets/
  tests/
```

Regras:

- **feature-first** quando o produto cresce (features/…).
- `ui/` é **agnóstico de domínio**.
- `services/` para HTTP, clients, interceptors e contratos.
- `lib/` para utilitários puros, sem dependências de React.

## 5. Convenções de Nomenclatura

- Componentes React: `PascalCase` (`UserCard.tsx`)
- Hooks: `useXxx` (`useUser.ts`)
- Funções/variáveis: `camelCase`
- Constantes: `UPPER_SNAKE_CASE` (apenas quando global e estável)
- Pastas: `kebab-case` ou `camelCase` (escolher 1 e padronizar)
- Arquivos de tipos: `types.ts` / `interfaces.ts` (preferir `types.ts`)
- Barrel exports: `index.ts` por pasta **com parcimônia** (evitar ciclos).

## 6. TypeScript — Padrões Obrigatórios

### 6.1 strict e segurança de tipo

- `strict: true` obrigatório.
- Proibido `any`. Use:
  - `unknown` + narrowing
  - generics
  - tipos discriminados

Exemplo (boundary controlada):

```ts
function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
```

Preferir boundary com validação:

```ts
import { z } from "zod";

const UserSchema = z.object({ id: z.string(), name: z.string() });
type User = z.infer<typeof UserSchema>;

export function parseUser(input: unknown): User {
  return UserSchema.parse(input);
}
```

### 6.2 Tipos e interfaces

- Preferir `type` para composições/unions.
- `interface` apenas para contratos extensíveis (ex.: libs).
- Evitar tipos gigantes: decompor em tipos menores.

### 6.3 Null/undefined

- Tratar explicitamente:
  - use `??` e `?.`
  - normalize em boundary (API/props)

### 6.4 Erros e Result

- Para fluxos previsíveis, preferir `Result` (ou padrão equivalente) ao invés de throw em cascata.
- Em UI, erro deve virar estado exibível (toast/alert).

## 7. React — Padrões de Componentes

### 7.1 Responsabilidade

- Componentes devem ser:
  - **puros** quando possível (props -> UI)
  - sem lógica de side-effect na renderização
- Side effects somente em `useEffect`/handlers.

### 7.2 Props e composição

- Preferir composição a props booleanas excessivas.
- Props:
  - obrigatórias primeiro
  - opcionais depois
  - callbacks sempre nomeados `onXxx`

Exemplo:

```tsx
type UserCardProps = {
  user: User;
  onSelect?: (id: string) => void;
};

export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <button type="button" onClick={() => onSelect?.(user.id)}>
      {user.name}
    </button>
  );
}
```

### 7.3 Hooks

- Hooks devem:
  - encapsular lógica e estados
  - expor API mínima (state + actions)
  - validar entradas e documentar retornos

### 7.4 Estado

Ordem de preferência:

1) estado local (`useState`)
2) lifting state (pai)
3) context **por domínio** (evitar context global gigante)
4) store (se necessário): Zustand/Redux (justificar)

### 7.5 Performance

- Evitar `useMemo/useCallback` por padrão; usar quando há prova de necessidade.
- Listas: usar `key` estável (nunca índice se ordem muda).
- Suspense/lazy para rotas e bundles grandes.

## 8. HTTP/API — Contratos e Camadas

- `services/api` deve:
  - concentrar chamadas HTTP
  - normalizar response
  - mapear erros (status -> erro semântico)
- UI não chama `fetch/axios` diretamente.

Exemplo de boundary:

```ts
export type ApiError = { code: string; message: string; status?: number };

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };
```

## 9. TailwindCSS — Padrões de Estilo

### 9.1 Princípios

- Tailwind primeiro, CSS custom só quando necessário.
- Evitar classes repetidas: extrair para componente, `cn()` ou variantes.

### 9.2 Classe utilitária e merge

- Usar helper `cn` (clsx + tailwind-merge).

```ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: Array<string | undefined | false>) {
  return twMerge(clsx(inputs));
}
```

### 9.3 Tokens e design system

- Definir tokens no `tailwind.config`:
  - cores, spacing, radius, shadow, font-size.
- Proibido “inventar” hex em componente sem token (salvo exceção aprovada).

### 9.4 Componentes com variantes

- Padronizar variantes com `cva` (class-variance-authority) quando houver.

```ts
import { cva, type VariantProps } from "class-variance-authority";

const button = cva("inline-flex items-center justify-center rounded-md", {
  variants: {
    variant: { primary: "font-semibold", ghost: "bg-transparent" },
    size: { sm: "h-8 px-3", md: "h-10 px-4" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

type ButtonProps = VariantProps<typeof button> & { className?: string };
```

### 9.5 Responsividade

- Mobile-first.
- Usar breakpoints consistentes (`sm`, `md`, `lg`, `xl`).
- Evitar estilos conflitantes entre breakpoints.

## 10. Acessibilidade (Obrigatório)

- Sempre:
  - `button` para ações, `a` para navegação
  - `aria-label` quando não há texto visível
  - foco visível (não remover outline sem substituto)
  - contraste adequado (tokens)
- Modais:
  - trap de foco
  - ESC fecha
  - `aria-modal` e título

## 11. Qualidade: Lint, Format e Commits

- ESLint obrigatório + regras sugeridas:
  - `@typescript-eslint/no-explicit-any`: error
  - `no-floating-promises`: error
  - `react-hooks/exhaustive-deps`: warn/error (definir)
- Prettier obrigatório.
- Commits: Conventional Commits (ex.: `feat:`, `fix:`, `chore:`).
- CI deve rodar: `lint`, `typecheck`, `test`.

## 12. Testes

- Unit: lógica pura, utils, schemas.
- Component: Testing Library (render + interação).
- E2E (opcional): Playwright/Cypress para fluxos críticos.

Regras:

- Testar comportamento, não implementação.
- Evitar snapshots grandes.

## 13. Segurança (Frontend)

- Nunca logar tokens/PII.
- Sanitizar inputs quando houver HTML (evitar `dangerouslySetInnerHTML`).
- Variáveis de ambiente:
  - `PUBLIC_` (ou padrão do framework) apenas para valores não-sensíveis.
- CSP e headers quando aplicável (especialmente em produção).

## 14. Checklist de PR (gate de merge)

- [ ] `pnpm/yarn/npm test` ok
- [ ] `lint` ok
- [ ] `typecheck` ok
- [ ] UI responsiva (mobile/desktop)
- [ ] A11y básica (labels, foco, teclado)
- [ ] Sem `any`, sem tokens/segredos no código
- [ ] Reuso: sem duplicação óbvia de classes/estilos

## 15. Exceções

Qualquer exceção a este padrão deve:

- estar documentada no PR
- justificar impacto e alternativa
- propor plano de correção se for dívida técnica
