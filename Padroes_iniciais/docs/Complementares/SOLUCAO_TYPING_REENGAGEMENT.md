# Solução: Indicador de Digitação (Typing) e Reengajamento (Cloud Run)

Este documento registra a solução definitiva para dois problemas críticos enfrentados na migração para o Google Cloud Run (21/12/2025).

## 1. Indicador de Digitação (Typing Indicator) 💬

### O Problema

A API do WhatsApp Cloud (v20+) rejeitava os payloads padrão de `typing_on` com erros como:

- `(#100) Param type must be one of {TEXT, ...} - got "sender_action"`
- `(#100) Invalid parameter` (quando enviado `type: "sender_action"`)

### A Solução

Descobrimos que a API aceita (e prefere) um **Payload Híbrido** que executa duas ações simultaneamente:

1. Marca a mensagem anterior como **Lida** (`status: "read"`).
2. Exibe o **Indicador de Digitação** (`typing_indicator: {"type": "text"}`).

### Payload Correto (Python)

Implementado em `src_gcp/servicos/meta_client.py`:

```python
def indicar_leitura_e_digitando(self, mensagem_id: str) -> None:
    payload = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": mensagem_id,         # ID da mensagem recebida do usuário
        "typing_indicator": {
            "type": "text"                 # Obrigatório especificar o tipo
        }
    }
    # POST para endpoint /messages
```

---

## 2. Reengajamento (Erro 403) 👻

### O Problema

O serviço de reengajamento (`lambda_mia_reengajamento.py`) executava a lógica corretamente (identificava usuários inativos), mas falhava ao tentar publicar o evento no Pub/Sub:

- Erro: `google.api_core.exceptions.PermissionDenied: 403 User not authorized to perform this action.`

### A Causa

As Service Accounts dos Workers (`sa-mia-conversa` e `sa-mia-reengajamento`) tinham permissão para **invocar** serviços e acessar o Datastore, mas **não tinham permissão explícita** para publicar em tópicos do Pub/Sub.

### A Solução (Terraform)

Adicionada a role `roles/pubsub.publisher` para as contas de serviço no arquivo `infra_gcp/modules/iam/main.tf`:

```hcl
resource "google_project_iam_member" "reeng_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.mia_reengajamento.email}"
}
```

## Resumo dos Arquivos Impactados

- `src_gcp/servicos/meta_client.py`: Nova implementação de `indicar_leitura_e_digitando`.
- `src_gcp/lambda_mia_conversa.py`: Atualizado para chamar o novo método.
- `infra_gcp/modules/iam/main.tf`: Adicionadas permissões de Pub/Sub.

---
*Gerado automaticamente pela IA (Antigravity).*
