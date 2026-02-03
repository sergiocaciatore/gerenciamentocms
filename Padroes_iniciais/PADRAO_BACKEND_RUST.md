# Padrão Backend (Rust) — Performance, Autonomia e Segurança

## 1. Objetivo
Definir padrões de implementação e operação de serviços backend em **Rust**, priorizando:
- **Performance** (baixa latência, alto throughput, uso eficiente de CPU/memória)
- **Autonomia** (serviços fáceis de manter, testar, evoluir e operar)
- **Segurança** (defesa em profundidade, hardening, controles e auditoria)

## 2. Escopo
Aplica-se a:
- APIs HTTP/gRPC, workers assíncronos, jobs, CLIs operacionais.
- Acesso a banco/filas/cache, observabilidade, autenticação/autorização.
- Qualidade (lint, testes, CI), empacotamento e release.

Não cobre frontend nem IaC em detalhe (apenas diretrizes de integração).

## 3. Stack de Referência (sugestão)
- Runtime assíncrono: **Tokio**
- HTTP: **axum** (ou actix-web, se justificável)
- gRPC: **tonic**
- Serialização: **serde**
- Validação: **validator** ou validação manual (preferir validação explícita em boundary)
- Banco: **sqlx** (Postgres/MySQL) ou drivers específicos; NoSQL via SDK oficial
- Observabilidade: **tracing** + **tracing-subscriber**
- Config: **config** / **figment** + env
- Erros: **thiserror** + **anyhow** (camadas bem definidas)
- Criptografia: **ring** (ou libs bem mantidas), **argon2** (quando aplicável)
- Testes: unit + integração + carga (critério em §12)

## 4. Estrutura de Pastas (referência)
```
backend/
  Cargo.toml
  Cargo.lock
  crates/
    app/                # bin principal (API/worker)
    domain/             # regras de negócio, tipos e invariantes
    usecases/           # orquestração de casos de uso
    adapters/           # http/grpc/db/queue/cache (implementações)
    contracts/          # DTOs, schemas, proto, OpenAPI
    observability/      # tracing, métricas, correlacionamento
    common/             # utilitários puros e shared types
  deploy/
  scripts/
  tests/                # integração/e2e
```

Regras:
- **domain** não depende de framework (axum/sqlx/etc).
- **adapters** contém IO (rede, banco, filas); mantém boundary clara.
- **contracts** versiona DTOs e contratos; evita “type leak” para domain.

## 5. Convenções de Nomenclatura
- Crates: `snake_case` (ex.: `observability`, `usecases`)
- Módulos: `snake_case`
- Tipos/structs/enums: `PascalCase`
- Funções/variáveis: `snake_case`
- Constantes: `SCREAMING_SNAKE_CASE`
- Erros: `XxxError` com códigos estáveis (ver §10)

## 6. Regras de Performance (Obrigatório)

### 6.1 Alocação e cópia
- Preferir **borrow** (`&str`, `&[u8]`) a copiar (`String`, `Vec<u8>`) em hot paths.
- Evitar `clone()` em fluxo crítico; se necessário, justificar em comentário.
- Preferir `Cow<'a, str>` para evitar cópia quando possível.
- Usar `Bytes` (crate `bytes`) para payloads de rede quando fizer sentido.

### 6.2 Async e concorrência
- Evitar bloquear o runtime Tokio:
  - I/O síncrono: usar versões async
  - CPU pesada: usar `spawn_blocking` ou pool dedicado
- Controlar concorrência:
  - `Semaphore`/`buffer_unordered`/`FuturesUnordered`
  - limitar fan-out e backpressure (ver §11)

### 6.3 Banco e rede
- Pooling obrigatório (ex.: `sqlx::Pool`).
- Queries:
  - usar `EXPLAIN` e índices para rotas críticas
  - proibir N+1
- Timeouts em tudo: HTTP client, DB, filas, cache.

### 6.4 Estruturas e algoritmos
- Escolher estrutura correta:
  - `HashMap` vs `BTreeMap`
  - `Vec` vs `SmallVec`
- Preferir parsing incremental/streaming para payload grande.
- Compilação com otimização para release (ver §14).

### 6.5 Medição é lei
- Performance sem benchmark é opinião:
  - `criterion` para microbench
  - teste de carga para endpoints críticos
- PR que altera hot path deve anexar evidência (benchmark/latência/p99).

## 7. Autonomia (Manutenibilidade e Operação)

### 7.1 Arquitetura por camadas
- Boundary: `contract -> adapter -> usecase -> domain`.
- Domain deve ser testável sem rede/banco.
- Adapters implementam traits definidos em usecases/domain (inversão de dependência).

### 7.2 Configuração
- Config via env + arquivo opcional (12-factor).
- Falhar rápido em config inválida (startup).
- Segredos nunca em arquivo versionado.

### 7.3 Feature flags
- Usar flags para rollout seguro.
- Proibir flags que mudam invariantes silenciosamente sem logs e métricas.

### 7.4 Logs e runbooks
- Cada serviço deve ter:
  - README operacional (como rodar local, deps)
  - runbook de incidentes (sintomas, dashboards, ações)

## 8. Qualidade de Código (Rust idiomático)
- `#![forbid(unsafe_code)]` por padrão.
  - `unsafe` só com justificativa, review dedicado e testes extras.
- `clippy` como gate (CI).
- `rustfmt` obrigatório.
- `deny(warnings)` no CI (ou tratar warnings como falha).

### 8.1 Lifetimes e ownership
- Resolver com design (interfaces) antes de “forçar” com clones.
- Se o borrow ficar complexo, considerar:
  - `Arc<T>` em compartilhamento
  - `Cow` em fronteiras
  - simplificar escopo de referências

## 9. Erros e Observabilidade (pilar de autonomia)

### 9.1 Erros
- Camadas expõem erros sem vazar detalhes sensíveis.
- Padronizar erro externo:
  - `code` (estável)
  - `message` (amigável)
  - `correlation_id`
- Diferenciar:
  - erro de validação (4xx)
  - erro de auth (401/403)
  - erro de domínio (409/422)
  - erro interno (500)

Sugestão:
```rust
#[derive(thiserror::Error, Debug)]
pub enum DomainError {
    #[error("regra de negócio violada: {0}")]
    RuleViolation(String),
    #[error("recurso não encontrado")]
    NotFound,
}
```

### 9.2 tracing e correlação
- `tracing` obrigatório:
  - spans por request/handler/usecase
  - `correlation_id` propagado em headers e logs
- Logs estruturados (JSON) em produção.
- Nunca logar PII/token (ver §10.4).

### 9.3 Métricas
- Expor métricas:
  - latência p50/p95/p99
  - taxa de erro por código
  - saturação de pool (DB)
  - fila/backlog/lag (workers)
- Alertas com SLOs (ex.: p99 < X ms, erros < Y%).

## 10. Segurança (Obrigatório)

### 10.1 Princípios
- Menor privilégio (serviço e operações).
- Defesa em profundidade:
  - validação em boundary
  - authn/authz
  - rate limit
  - auditoria
  - hardening e dependências

### 10.2 Autenticação e autorização
- Autenticação via:
  - JWT (assinado, exp curto, rotacionável) ou
  - mTLS (gRPC) onde aplicável
- Autorização:
  - policy explícita no usecase (não só no handler)
  - checagem por recurso (resource-based)

### 10.3 Validação de entrada
- Validar em boundary (DTO):
  - tamanho máximo
  - charset/formato
  - ranges
- Proibir deserialização permissiva sem limites:
  - aplicar limites de payload (bytes) e campos

### 10.4 Segredos e PII
- Segredos:
  - apenas via secret manager/env
  - nunca em logs, panics, métricas
- PII:
  - mascarar (ex.: últimos 4 dígitos) quando inevitável logar
  - criptografia em repouso e em trânsito (TLS)

### 10.5 Dependências e supply chain
- `cargo audit` obrigatório no CI.
- Atualizar deps com frequência e rastrear CVEs.
- Proibir dependência não mantida (sem releases/atividade) em componentes críticos.
- Pin de versões (Cargo.lock) obrigatório.

### 10.6 Hardening
- Headers de segurança (HTTP) quando aplicável.
- Limitar métodos, CORS mínimo necessário.
- Rate limit por IP/tenant/token.
- Proteção contra DoS:
  - limites de payload
  - limites de concorrência
  - timeouts
  - circuit breaker/retry com jitter no client

## 11. Resiliência e Backpressure
- Timeouts em cadeia: handler -> usecase -> adapter.
- Retentativas:
  - apenas em operações idempotentes
  - com backoff exponencial + jitter
- Circuit breaker em integrações instáveis.
- Workers:
  - consumo com concurrency limitada
  - DLQ/poison message strategy
  - reprocessamento controlado e auditável

## 12. Testes (Obrigatório)
- Unit (domain/usecases):
  - invariantes, regras e validação
- Integração (adapters):
  - banco real via container
  - migrations e queries críticas
- Contrato:
  - OpenAPI/proto validado em CI
- Carga/Performance:
  - endpoints críticos com cenário mínimo (p95/p99)

Regras:
- Testar comportamento, não implementação.
- Sem dependência de rede externa em testes do CI.

## 13. Padrões de API

### 13.1 REST
- Rotas versionadas: `/v1/...`
- Idempotência:
  - `PUT` idempotente
  - `POST` pode suportar idempotency-key
- Respostas padronizadas:
```json
{ "ok": true, "data": { } }
{ "ok": false, "error": { "code": "X", "message": "Y", "correlation_id": "..." } }
```

### 13.2 gRPC
- Proto versionado (package + breaking changes controladas).
- Interceptors para:
  - auth
  - correlation id
  - métricas
- Deadlines obrigatórios do client.

## 14. Build, Release e Runtime

### 14.1 Build
- `cargo build --release` obrigatório para produção.
- LTO e codegen-units (quando aplicável) para bin final:
  - considerar `lto = "thin"` e `codegen-units = 1` para latência/size (benchmarkar).
- `strip` no bin quando apropriado.

### 14.2 Runtime
- Variáveis de runtime:
  - `RUST_LOG`/config de tracing por env
  - limites de memória/threads conforme ambiente
- Panics:
  - capturar e converter para erro 500 sem vazar dados
  - crash only se corrupção/invariante crítica (log + alert)

## 15. Checklist de PR (gate de merge)
- [ ] `cargo fmt` ok
- [ ] `cargo clippy` ok (sem warnings)
- [ ] `cargo test` ok
- [ ] `cargo audit` ok
- [ ] Timeouts/rate limits definidos em integrações
- [ ] Logs com `tracing` + correlation_id
- [ ] Sem `unsafe` (ou justificado e revisado)
- [ ] Sem secrets/PII em logs
- [ ] Alteração de hot path acompanhada de benchmark/latência

## 16. Exceções
Qualquer exceção a este padrão deve:
- estar documentada no PR
- justificar impacto (performance/segurança/autonomia)
- incluir plano de mitigação/correção quando for dívida técnica
