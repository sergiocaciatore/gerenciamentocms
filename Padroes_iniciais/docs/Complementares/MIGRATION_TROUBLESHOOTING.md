# Histórico de Resolução de Problemas - Deploy Mia v2 (GCP)

Este documento registra os desafios técnicos encontrados durante a migração e deploy da Mia v2 para o Google Cloud Platform (Cloud Run) e as soluções aplicadas.

## 1. Infraestrutura e Terraform

### Problema: VPC Deletion Race Condition

**Erro:** Falha ao destruir `vpc-mia-dev` durante o `terraform apply`.
**Causa:** A VPC ainda estava em uso por recursos pendentes (Conectores VPC ou instâncias Redis) que não foram destruídos a tempo.
**Solução:**

- Remoção manual da VPC do estado do Terraform (`terraform state rm`).
- Execução forçada de limpeza via CLI (`gcloud compute networks delete`).

---

## 2. Dependências e Build

### Problema: ModuleNotFoundError (redis, pypdf)

**Erro:** O container falhava ao iniciar com erros de importação.
**Causa:** As bibliotecas `redis` e `pypdf` não estavam listadas no `requirements.txt`, mas eram usadas no código.
**Solução:** Adicionadas as dependências `redis>=5.0.0` e `pypdf>=3.0.0` ao `requirements.txt` e rebuild da imagem.

---

## 3. Configuração de Runtime (Variáveis de Ambiente)

### Problema: Redis Connection Refused (localhost)

**Erro:** `redis.exceptions.ConnectionError: Error 111 connecting to localhost:6379`.
**Causa:** O código Python (`sessao_redis.py`) tinha um valor default `localhost`. No GCP, o Redis (Memorystore) roda em um IP interno separado.
**Solução:** Ajustado o código para ler explicitamente as variáveis `REDIS_HOST` e `REDIS_PORT` injetadas pelo Terraform.

### Problema: Datastore Invalid Argument (Missing Project ID)

**Erro:** `400 Invalid resource field value... RESOURCE_PROJECT_INVALID`.
**Causa:** O cliente do `google-cloud-datastore` tentou iniciar sem um Project ID explícito, e a inferência automática falhou ou não foi passada corretamente.
**Solução:** Adicionada a variável `PROJECT_ID` no Terraform (`modules/cloudrun/main.tf`) e atualizada a classe `SessaoDynamoRepositorio` para ler essa env var.

### Problema: Mensagem não enviada (Meta API)

**Erro:** `ERROR:src.servicos.meta_client:META_PHONE_NUMBER_ID ou Token do WhatsApp não configurados.`
**Causa:** A variável de ambiente `META_PHONE_NUMBER_ID` não estava sendo passada para o container. Além disso, a variável `BUCKET_NAME` tinha nome diferente do esperado (`NOME_BUCKET_MIDIAS_MIA`).
**Solução:** Corrigido o mapeamento de variáveis no Terraform (`modules/cloudrun`).

---

## 4. Estabilidade e Lógica

### Problema: Concorrência no Datastore (Erro 409)

**Erro:** `409 Aborted due to cross-transaction contention`.
**Causa:** Tentativa de escrita simultânea na mesma entidade de sessão (usuário enviando mensagens rápido ou retentativas).
**Solução:** Implementado **Retry com Backoff Exponencial** no `sessao_dynamo.py` para lidar graciosamente com colisões de transação.

### Problema: Mensagens Duplicadas

**Erro:** O robô respondia a mesma mensagem duas vezes.
**Causa:** Timeout no Webhook do WhatsApp (Meta reenvia a mensagem se não receber 200 OK rápido) ou latência interna.
**Solução:** Implementada **Deduplicação via Redis** (`verificar_duplicidade`). O ID da mensagem é salvo no Redis com TTL curto; se o mesmo ID chegar novamente, é ignorado.

### Problema: Falha no Reengajamento (Cloud Scheduler)

**Erro:** Logs de timeout e erro de índice no Datastore.
**Causa:** A query original tentava filtrar por `status` E `timestamp` combinados, o que exige um Índice Composto (Composite Index) no Datastore.
**Solução:** Simplificada a query para buscar apenas por `status` no banco e filtrar o `timestamp` em memória (Python), eliminando a necessidade de criar índices complexos imediatamente.

---

## Resumo Final

O ambiente agora está estável, com tratamento de erros robusto para redes, concorrência e idempotência.

**Arquivos Chave Alterados:**

- `infra_gcp/modules/cloudrun/main.tf`: Injeção correta de Env Vars.
- `src gcp/repositorios/sessao_redis.py`: Correção de host e deduplicação.
- `src gcp/repositorios/sessao_dynamo.py`: Retry para erro 409 e Query simplificada.
- `src gcp/lambda_mia_conversa.py`: Lógica de deduplicação e inicialização correta.
