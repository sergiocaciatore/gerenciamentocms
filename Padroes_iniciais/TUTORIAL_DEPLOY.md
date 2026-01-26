# 🚀 Guia de Deploy AWS - Projeto Mia

Este guia descreve o passo a passo **obrigatório** para realizar o deploy em produção.

## 📋 Pré-requisitos

Certifique-se de que seu ambiente possui:

1. **Docker** rodando (Abra o Docker Desktop).
2. **AWS CLI** instalado.
3. **Permissões**: Acesso às credenciais da conta TI.

---

## � Passo a Passo

Siga esta ordem exata para evitar erros de permissão ou enviou para conta errada.

### 1️⃣ Passo 1: Validar Conta TI (Produção)

Primeiro, você deve garantir que está conectado na conta correta (**Conta TI - 537037385138**).

Execute o comando abaixo e escolha a **Opção [2]**:

```bash
./credenciais/trocar_conta.sh
```

> **Atenção:** Se o deploy falhar com "ExpiredToken", repita este passo.

### 2️⃣ Passo 2: Executar Deploy

Com a conta validada, execute o script de deploy completo.  
Este script atualiza **todas** as Lambdas (Core, Webhook, CRM, Reengajamento) de uma vez.

```bash
./scripts/force_deploy_full.sh
```

**O que este script faz:**

1. Faz login no registro de containers (ECR).
2. Constrói as novas versões (Build Docker).
3. Envia para a nuvem (Push).
4. Atualiza o código das Lambdas em produção.

---

## ✅ Como saber se deu certo?

Ao final do script, procure pela mensagem:
`✅ DEPLOY TOTAL CONCLUÍDO!`

## ⚠️ Problemas Comuns

**Erro**: `ExpiredTokenException` / `GetAuthorizationToken operation`
**Solução**: Seu token expirou. Volte ao **Passo 1** e rode o seletor de contas novamente.

**Erro**: `docker: command not found`
**Solução**: O Docker Desktop não está rodando. Abra-o e tente novamente.
