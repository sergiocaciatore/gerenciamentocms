# Relatório de Infraestrutura AWS

**Projeto:** Mia v2 (Ambiente: PROD)
**Região:** us-east-2 (Ohio)
**Data do Relatório:** 10/01/2026 (Métricas dos últimos 7 dias)

---

## 1. Compute (AWS Lambda)

Serviços responsáveis pelo processamento das requisições. Todos os lambdas do core foram atualizados para **2GB de memória** para melhor performance.

| Nome do Serviço | Função (Descrição) | Memória | Timeout | Requisições (7d) | Latência Média | Erros (7d) |
|---|---|---|---|---|---|---|
| **mia-conversa-prod** | **Core (Worker)**. Processa áudio/texto, chama OpenAI e gera resposta de voz. | 2048 MB | 120s | **4.906** | ~1.08s | 22 |
| **mia-meta-webhook-prod** | **Webhook WhatsApp**. Recebe eventos do Meta e enfileira no SQS. Alta concorrência. | 2048 MB | 30s | **1.687** | ~368ms | 0 |
| **mia-reengajamento-prod** | **Cron Job**. Roda a cada minuto para buscar sessões inativas e reengajar. | 2048 MB | 60s | **1.475** | ~401ms | 0 |
| **mia-crm-sender-prod** | **Integrador CRM**. Envia leads qualificados para o Dynamics (fluxo assíncrono). | 2048 MB | 60s | **28** | ~7.94s | 0 |
| **mia-campanha-prod** | **Disparador de Campanhas**. Endpoint backend para Landing Pages (disparo em massa/individual). | 128 MB | 15s | **17** | ~610ms | 0 |

> **Nota sobre Latência:** O `mia-crm-sender` possui latência mais alta (~8s) devido à comunicação externa síncrona com a API do Dynamics e processamento de IA para resumo. O `mia-conversa` mantém ~1s mesmo processando áudio/OpenAI, o que é excelente.

---

## 2. Banco de Dados (DynamoDB)

Armazenamento NoSQL para sessões de usuário e controle de estado conversacional.

* **Tabela:** `Sessao-prod`
* **Chave Primária:** `cliente_id` (String)
* **Modo de Pagamento:** On-Demand (Pay-per-request)
* **TTL (Time-to-Live):** Ativado (campo `ttl`)
* **Métricas Atuais:**
  * **Quantidade de Itens:** 16
  * **Tamanho Total:** 11.5 KB

---

## 3. Armazenamento (S3)

Armazenamento de mídias temporárias (áudios recebidos/gerados) e logs de campanha.

* **Bucket:** `mia-midias-mia-prod`
* **Configuração:** Privado, com regras de CORS para acesso controlado.
* **Uso Atual:**
  * **Objetos:** 2 arquivos
  * **Tamanho Total:** ~32 KB

---

## 4. Mensageria (SQS)

Filas para desacoplamento de serviços e garantia de entrega (Retry + DLQ).

| Fila (Queue) | Função | Mensagens Visíveis (Backlog) | Configuração de DLQ |
|---|---|---|---|
| `fila-eventos-whatsapp-prod` | Buffer entre Webhook Meta -> Lambda Conversa. | 0 | Sim (`...whatsapp-dlq-prod`) |
| `fila-leads-crm-prod` | Buffer para envio de leads ao Dynamics. | 0 | Sim (`...crm-dlq-prod`) |

*As filas DLQ (Dead Letter Queues) existem para capturar mensagens que falharam após 5 tentativas de processamento.*

---

## 5. Container Registry (ECR)

Repositórios de imagens Docker utilizadas pelas Lambdas.

* **mia-core-prod**: Imagem base do Core (Conversa, CRM, Reengajamento).
* **mia-webhook-prod**: Imagem leve e otimizada apenas para receber requisições do Webhook.
* **Política:** `MUTABLE`, Scan on push ativado.

---

## 6. Autenticação (Cognito)

Gerenciamento de usuários para o Painel Administrativo (Dashboard).

* **Pool Name:** `mia-dashboard-users-prod`
* **Políticas:** Senha forte (8 chars, Upper, Lower, Number), MFA Desativado.
* **Clientes:** `mia-dashboard-client-prod` (para SPA React).
