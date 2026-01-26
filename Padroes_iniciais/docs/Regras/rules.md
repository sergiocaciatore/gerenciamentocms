# Padrões de Desenvolvimento e Boas Práticas

Diretrizes técnicas e de estilo para garantir a qualidade, manutenibilidade e escalabilidade dos serviços. Todos os desenvolvedores devem aderir a este guia.
Idioma padrão para comentários em código, nome de funções ou qualquer interação com código deve ser sempre em português/brasileiro, nunca em outro idioma

## 1. Python (Backend & Lambdas)

A base do desenvolvimento backend é Python 3.13+. Priorizamos código explícito, tipado e imutável.

### 1.1. Estrutura de Arquivos e Imports

Os imports devem seguir rigorosamente a ordem abaixo, separados por uma linha em branco:

1. **Future imports**: `from __future__ import annotations` (Obrigatório na primeira linha).
2. **Biblioteca Padrão**: `import os`, `import logging`, `from dataclasses ...`.
3. **Bibliotecas de Terceiros**: `import requests`, `from openai ...`.
4. **Módulos Locais**: Imports do próprio projeto (ex: `from src_gcp.modelos ...`).

**Exemplo:**

```python
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Final, Optional

import requests
from openai import OpenAI

from src_gcp.servicos.ia_mia import IAMia
```

### 1.2. Tipagem e Imutabilidade

O código deve ser estritamente tipado (`mypy` compliant).

* **Type Hints**: Use `typing` (List, Dict, Optional, Final) em **todos** os argumentos e retornos de função.
* **Dataclasses**: Para objetos de valor/configuração, use `@dataclass(frozen=True, slots=True)`. Isso garante imutabilidade e economia de memória.
* **Constantes**: Use `Final[Tipo]` para constantes globais.

### 1.3. Injeção de Dependência e Configuração

Evite instanciar configurações ou *clients* (boto3, OpenAI) no meio do código.

* **Configuração**: Use uma classe `Config` com um método estático `from_env()` para carregar variáveis de ambiente.
* **Serviços**: Receba dependências no construtor (`__init__`). Isso facilita testes unitários.

**Exemplo:**

```python
@dataclass(frozen=True, slots=True)
class CanaryConfig:
    """Configuração imutável carregada do ambiente."""
    openai_api_key: str

    @classmethod
    def from_env(cls) -> CanaryConfig:
        return cls(openai_api_key=os.environ["OPENAI_API_KEY"])

class CanaryService:
    def __init__(self, config: Optional[CanaryConfig] = None) -> None:
        self.config = config or CanaryConfig.from_env()
```

### 1.4. Tratamento de Erros e Logs

* **Logs Estruturados**: Use `logging.getLogger()`. Nunca use `print`.
* **Exceções**: Capture exceções específicas. Se capturar `Exception` genérica, **sempre logue o erro** com `logger.error` ou `logger.exception`.
* **Métricas via Log**: Para o GCP Cloud Run/Functions, logs estruturados podem ser usados como métricas (ex: `[METRIC] ...`).

### 1.5. Serverless Handlers

O arquivo do Lambda (`handler`) deve ser exclusivamente um **Controlador**.

* **Responsabilidade**: Receber o evento, instanciar o Serviço e retornar a resposta.
* **Lógica de Negócio**: Deve residir inteiramente em classes de Serviço (`src_gcp/servicos`), **nunca** no handler.

---

## 2. Comentários e Documentação

A documentação é parte integrante do código.

* **Idioma**: Português do Brasil (pt-BR).
* **Docstrings**: Obrigatórias para todos os Módulos, Classes e Métodos Públicos. Use o formato de bloco para descrever responsabilidade, argumentos e retorno.

**Padrão de Docstring:**

```python
def verificar_saude(self) -> Dict[str, int]:
    """
    Executa os health checks nos serviços dependentes.
    
    Responsabilidade:
    - Verificar conectividade com OpenAI e Meta.
    - Gerar logs de métrica para monitoramento.

    Returns:
        Dict[str, int]: Dicionário com status (1=UP, 0=DOWN) por serviço.
    """
```

---

## 3. Qualidade de Código (CI/CD)

Todo commit passa por validação automática (pipeline). Não quebre o build.
Ferramentas obrigatórias (ver `azure-pipelines.yml`):

* **Ruff**: Linter rápido para estilo e erros comuns.
* **Black**: Formatador de código (sem discussão sobre estilo, o Black decide).
* **Mypy**: Validação estática de tipos.
* **Pytest**: Testes unitários.

---

## 4. Docker

* **Imagens Mínimas**: Use *multistage building* para gerar imagens finais leves (apenas runtime + dependências de prod).
* **Usuário**: Jamais execute como `root` na imagem final. Crie um usuário `app user`.
* **Contexto**: Copie apenas o necessário (`COPY src/ .`) para aproveitar o cache de camadas.

---

## 5. Terraform (Infra as Code)

* **Nomenclatura**: `snake_case` para resources e variables.
* **State**: O estado deve ser remoto (GCS/S3) com Locking (DynamoDB/GCP Lock).
* **Módulos**: Evite duplicar código. Crie módulos para recursos repetitivos (ex: Cloud Run Service).
* **Secrets**: Nunca commitar `.tfvars` com senhas. Use Secret Manager ou injeção via pipeline.

---

## 6. Git & Versionamento

* **Commits**: Use mensagens imperativas e descritivas.
  * *Bom*: "Adiciona validação de CPF no cadastro"
  * *Ruim*: "fix bug", "ajustes"
* **Branches**:
  * `main`: Produção (Estável).
  * `develop`: Integração (Instável).
  * `feature/nome-da-feature`: Desenvolvimento local.
