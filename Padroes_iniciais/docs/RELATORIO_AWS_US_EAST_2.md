# Relatório de Serviços AWS - Região us-east-2 (Ohio)

**Data da Verificação:** 12/01/2026

Este relatório lista os serviços AWS ativos encontrados na região `us-east-2` durante a varredura automatizada.

## Resumo Executivo

Foram identificados recursos ativos nos serviços **Lambda**, **DynamoDB** e **SQS**. Nenhum recurso foi encontrado para EC2, RDS, ECS, EKS, SNS, API Gateway, CloudFormation ou Cognito nesta região.

## Detalhamento dos Recursos

### 1. AWS Lambda (Funções)

- `mia-conversa-prod`
- `mia-reengajamento-prod`
- `mia-crm-sender-prod`
- `mia-meta-webhook-prod`
- `mia-campanha-prod`

### 2. Amazon DynamoDB (Tabelas)

- `Sessao-prod`

### 3. Amazon SQS (Filas)

- `fila-eventos-whatsapp-dlq-prod`
- `fila-eventos-whatsapp-prod`
- `fila-leads-crm-dlq-prod`
- `fila-leads-crm-prod`

### 4. Amazon S3 (Global / Configurações)

- **Bucket:** `mia-midias-mia-prod`
  - **Conteúdo Crítico:** `mia_config.json` (Armazena Prompt do Sistema, Regras de Reengajamento e Flags).
  - **Mecanismo:** A Lambda lê este arquivo periodicamente para obter configurações dinâmicas sem precisar de redeploy.

### 5. Serviços Verificados (Sem Recursos Encontrados)

Os seguintes serviços foram verificados, mas **não retornaram recursos ativos**:

- **Compute**: Amazon EC2, Amazon ECS, Amazon EKS.
- **Database**: Amazon RDS.
- **Messaging**: Amazon SNS.
- **Networking/API**: Amazon API Gateway (REST & HTTP/WebSocket).
- **Security/Identity**: Amazon Cognito User Pools.
- **IAC**: AWS CloudFormation Stacks.

---
*Relatório gerado automaticamente via AWS CLI.*
