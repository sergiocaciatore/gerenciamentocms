# DIRETRIZES GERAIS

1. **Idioma**: Todos os comentários, docstrings, documentação e logs DEVEM ser escritos em **Português do Brasil (pt-BR)**.
2. **Qualidade**: Priorize código explícito, tipado e imutável.
3. **Padrão de Qualidade**: Não aceite código sem documentação adequada ou com tipagem "any" (exceto em casos extremos devidamente justificados).

---

PADRÃO PYTHON (Backend & Lambdas)

Siga o guia de estilo do projeto para Python 3.13+:

## 1. Docstrings

Obrigatório para todos os Módulos, Classes e Métodos Públicos. Use o formato de bloco abaixo:

```python
def nome_da_funcao(parametro: Tipo) -> Retorno:
    """
    Descrição concisa do que a função faz.
    Responsabilidade:
    - Listar as principais responsabilidades dessa função.
    - Explicar regras de negócio críticas.
    Args:
        parametro (Tipo): Descrição do parâmetro.
    Returns:
        Retorno: Descrição do que é retornado.
    """
2. Imports
Mantenha a ordem estrita, separados por linha em branco:

from __future__ import annotations
Biblioteca Padrão (os, logging, typing)
Bibliotecas de Terceiros (requests, pydantic)
Imports Locais (from src.modelos ...)
3. Tipagem
Use Type Hints estritos. Utilize Final, Optional, List, Dict do módulo typing ou tipos nativos modernos.

Constantes globais devem ser Final.
Use @dataclass(frozen=True, slots=True) para objetos de valor.
PADRÃO TYPESCRIPT (Frontend & Scripts)
1. JSDoc
Obrigatório para todas as Funções, Componentes Exportados e Interfaces.

typescript
/**
 * Descrição concisa do componente ou função.
 * 
 * Responsabilidade:
 * - Listar o que este componente/função resolve.
 * - Detalhes sobre efeitos colaterais (ex: chamadas de API).
 * 
 * @param {Tipo} nomeParametro - Descrição do parâmetro em pt-BR.
 * @returns {Tipo} Descrição do retorno em pt-BR.
 */
export const ExemploComponente = (props: Props): JSX.Element => { ... }
2. Tipagem
Proibido: Uso de any. Defina interfaces claras para todas as props e estruturas de dados.
Interfaces: Prefira interface a type para definições de objetos. Nomeie interfaces claramente (ex: UsuarioProps, ConfiguracaoSistema).
3. Código Limpo
Comentários de linha (//) apenas para explicar "o porquê" de uma lógica complexa, nunca "o que" o código faz.
Variáveis e funções devem ter nomes semânticos em Inglês (padrão de código) ou Português (se o projeto adotar nomes em pt-BR, mantenha a consistência), mas a documentação é sempre pt-BR.
