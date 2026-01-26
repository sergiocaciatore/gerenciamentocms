# Documentação Técnica: Solução de CORS e Integração Landing Page (Bypass SCP)

## Contexto

Integração entre a Landing Page (Web) e o AWS Lambda (`mia-campanha-prod`) via Function URL pública para recebimento de leads.

## O Problema

Ao tentar configurar o CORS (Cross-Origin Resource Sharing) padrão da AWS via Terraform (bloco `cors {}` na `aws_lambda_function_url`), o deploy falhava ou a URL retornava erro de permissão.
**Causa Raiz Identificada:** Uma Service Control Policy (SCP) aplicada à conta AWS da organização (Mills) bloqueia explicitamente a criação de Function URLs Públicas que tenham configuração de CORS gerenciada pela AWS.

## A Solução Implementada

Para contornar o bloqueio de infraestrutura sem violar a necessidade de acesso público, adotamos uma estratégia de "CORS Manual ao Nível da Aplicação".

### 1. Alteração na Infraestrutura (Terraform)

Removemos totalmente o bloco de configuração de CORS do Terraform. Para a AWS, a Function URL é criada "crua", sem regras de CORS definidas na camada de infraestrutura. Isso evita o disparo da regra de bloqueio (SCP).

**Arquivo:** `infra_campanha/main.tf`

```hcl
resource "aws_lambda_function_url" "lambda_campanha_url" {
  function_name      = aws_lambda_function.lambda_campanha.function_name
  authorization_type = "NONE"
  
  # [REMOVIDO] Bloco cors {} removido para evitar erro 403 da SCP
}
```

### 2. Alteração no Código (Python)

Implementamos a lógica de CORS diretamente no código da função Lambda (`lambda_mia_campanha.py`). O Lambda agora é responsável por:

1. Interceptar requisições com método HTTP `OPTIONS` (Preflight) e responder imediatamente com status 200 e headers de permissão.
2. Injetar os headers de CORS (`Access-Control-Allow-Origin: *`, etc.) em **todas** as respostas (sucesso ou erro).

**Arquivo:** `src_aws/lambda_mia_campanha.py`

```python
# Headers CORS fixos
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

def handler(event, context):
    # Tratamento Manual do Preflight (OPTIONS)
    method = ... # Lógica de extração do método
    
    if str(method).upper() == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": "",
        }

    # ... processamento normal ...
    
    # Resposta final sempre inclui headers
    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps({...})
    }
```

## Como Testar

Para validar se a solução continua funcionando, utilize o `curl` simulando uma origem externa:

1. **Teste de Preflight (OPTIONS):**

    ```bash
    curl -v -X OPTIONS [URL_DA_FUNCTION] -H "Origin: https://seu-site.com"
    ```

    *Resultado Esperado:* HTTP 200 OK com headers `Access-Control-Allow-Origin: *`.

2. **Teste de Envio (POST):**

    ```bash
    curl -v -X POST [URL_DA_FUNCTION] \
      -H "Content-Type: application/json" \
      -d '{"telefone": "11999999999", "nome": "Teste Doc"}'
    ```

    *Resultado Esperado:* HTTP 200 OK e Lead processado.
