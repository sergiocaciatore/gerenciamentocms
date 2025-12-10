# CMS Engenharia - Design Guidelines

Este documento define os padrões de design utilizados no frontend do projeto, com foco na estética "Liquid Glass" (Apple-style).

## 1. Filosofia Visual
O design busca uma aparência moderna, limpa e premium, utilizando transparências, desfoque (blur) e sombras suaves para criar profundidade e hierarquia.

## 2. Padrão "Liquid Glass" (Card)
O componente principal de container (como visto na tela de Login) segue o padrão de vidro fosco.

### Estrutura e Classes Tailwind
Para replicar o efeito de card "Liquid Glass", utilize a seguinte combinação de utilitários:

```tsx
<div className="
  relative
  overflow-hidden
  rounded-3xl
  bg-white/20           /* Fundo branco semi-transparente */
  shadow-2xl            /* Sombra profunda */
  backdrop-blur-xl      /* Desfoque intenso no fundo */
  ring-1 ring-white/30  /* Borda sutil e brilhante */
  transition-all duration-500
  hover:shadow-3xl hover:bg-white/25 /* Interatividade no hover */
">
  {/* Conteúdo */}
</div>
```

### Elementos Decorativos (Glow)
Para adicionar profundidade e cor ao fundo do vidro, utilize "orbs" coloridos com blur posicionados absolutamente dentro do container pai (mas atrás do card ou dentro dele com z-index menor):

```tsx
{/* Orb Roxo */}
<div className="absolute -top-10 -left-10 h-32 w-32 rounded-full bg-purple-500/30 blur-2xl"></div>
{/* Orb Azul */}
<div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-blue-500/30 blur-2xl"></div>
```

## 3. Plano de Fundo (Background)
O corpo da aplicação (`body`) utiliza um gradiente animado para destacar o efeito de transparência dos componentes.

**CSS (`index.css`):**
```css
body {
  background: radial-gradient(circle at 0% 0%, #ff9a9e 0%, #fecfef 20%, #feada6 40%, #f5efef 60%, #a1c4fd 80%, #c2e9fb 100%);
  background-size: 200% 200%;
  animation: gradientBG 15s ease infinite;
}
```

## 4. Tipografia e Ícones
- **Fonte**: Inter (ou system-ui).
- **Cores de Texto**:
  - Títulos: `text-gray-900` (Alto contraste).
  - Subtítulos/Corpo: `text-gray-600` (Médio contraste).
- **Ícones**: Devem ser simples, vetoriais (SVG), e seguir a paleta de cores neutra (`text-gray-700`) ou da marca.

## 5. Botões
Os botões devem ter uma aparência tátil e levemente elevada.

```tsx
<button className="
  rounded-xl
  bg-white/90
  px-6 py-3.5
  text-sm font-semibold text-gray-900
  shadow-lg
  transition-all
  hover:bg-white hover:scale-[1.02] active:scale-[0.98]
">
  {/* Label */}
</button>
```

## 6. Modais
Os modais são utilizados para formulários de cadastro e edições. Eles devem focar a atenção do usuário desfocando o fundo.

### Componente Padrão (`Modal.tsx`)
Utilize o componente `Modal` localizado em `src/components/Modal.tsx`.

**Características:**
- **Backdrop**: `bg-black/30 backdrop-blur-sm` (Escurece e desfoca o fundo).
- **Container**: `bg-white/90 backdrop-blur-xl` (Vidro fosco, bordas arredondadas `rounded-2xl`, sombra `shadow-2xl`).
- **Título**: `text-lg font-medium text-gray-900`.
- **Botão Fechar**: Ícone "X" no canto superior direito.

**Exemplo de Uso:**
```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Título do Modal"
>
  <form>
    {/* Campos do formulário */}
    <div className="mt-6 flex justify-end gap-3">
      <button type="button" onClick={onClose} className="...">Cancelar</button>
      <button type="submit" className="...">Salvar</button>
    </div>
  </form>
</Modal>
```
