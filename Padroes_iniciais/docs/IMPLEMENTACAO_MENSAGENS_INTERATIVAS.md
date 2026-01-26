# Implementação de Mensagens Interativas no Fluxo da MIA

Este documento descreve como implementar Mensagens Interativas (Listas e Botões) do WhatsApp Business API no backend da MIA, conforme a [documentação oficial da Meta](https://developers.facebook.com/docs/whatsapp/guides/interactive-messages/?locale=pt_BR).

## 1. Visão Geral

As Mensagens Interativas oferecem uma experiência de usuário superior comparada a menus de texto simples:

* **List Messages**: Menu com até 10 opções (ex: selecionar serviço, agendar horário).
* **Reply Buttons**: Até 3 botões de resposta rápida (ex: Sim/Não, Confirmar).

### Benefícios

* Maior taxa de conversão.
* Menos erros de digitação do usuário.
* Fluxo mais ágil e intuitivo.

---

## 2. Estratégia de Implementação

A implementação envolve alterações na classe de serviço `IAMia` (responsável pela lógica de envio) e no endpoint de Webhook (responsável por receber as respostas).

### A. Atualização da Classe `IAMia` (`src_gcp/servicos/ia_mia.py`)

Atualmente, o método de envio (ex: `enviar_mensagem`) provavelmente suporta apenas texto. Devemos criar métodos específicos ou adaptar o existente para aceitar um payload `interactive`.

#### Exemplo de Payload para Botões (Reply Buttons)

```python
def build_reply_buttons(to_number, text_body, buttons_list):
    """
    buttons_list: Lista de dicts [{'id': 'btn_1', 'title': 'Opção 1'}]
    Máximo 3 botões.
    """
    return {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_number,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": text_body
            },
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": btn["id"],
                            "title": btn["title"]
                        }
                    } for btn in buttons_list
                ]
            }
        }
    }
```

#### Exemplo de Payload para Listas (List Messages)

```python
def build_list_message(to_number, text_body, button_text, sections):
    """
    sections: Lista de seções com rows.
    Ex: [{'title': 'Seção 1', 'rows': [{'id': 'opt1', 'title': 'Opção 1', 'description': 'Desc 1'}]}]
    Máximo 10 opções no total.
    """
    return {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_number,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {
                "text": text_body
            },
            "action": {
                "button": button_text,
                "sections": sections
            }
        }
    }
```

---

## 3. Integração com o Fluxo Conversacional

O fluxo da MIA deve decidir **quando** enviar uma mensagem interativa em vez de texto.

### Cenários de Uso

1. **Confirmações Simples**: Quando a IA pergunta "Podemos prosseguir?", enviar Botões `["Sim", "Não"]`.
2. **Seleção de Horários**: Ao agendar, enviar uma Lista com os slots disponíveis.
3. **Desambiguação**: Se a IA identificar múltiplas intenções, oferecer uma Lista para o usuário escolher.

### Lógica na `IAMia`

```python
# Pseudo-código dentro do processamento da resposta da IA
if contexto == "confirmacao_agendamento":
    payload = build_reply_buttons(cliente_numero, "Você confirma o agendamento para 14:00?", [{"id": "conf_sim", "title": "Sim"}, {"id": "conf_nao", "title": "Não"}])
    requests.post(META_API_URL, json=payload, headers=HEADERS)
else:
    # Envio normal de texto
    send_text_message(cliente_numero, resposta_ia)
```

---

## 4. Tratamento de Respostas (Webhook)

O endpoint de webhook (em `main.py` ou `lambda_handler.py`) precisa ser atualizado para processar o tipo de mensagem `interactive`.

### Payload Recebido da Meta

Quando o usuário clica em um botão ou lista, o webhook recebe um evento diferente de `text`:

```json
{
  "messages": [{
    "type": "interactive",
    "interactive": {
      "type": "button_reply", 
      "button_reply": {
        "id": "conf_sim",
        "title": "Sim"
      }
    }
  }]
}
```

### Processamento

No webhook:

1. Verificar se `msg['type'] == 'interactive'`.
2. Extrair o `id` da resposta (`msg['interactive']['button_reply']['id']` ou `list_reply`).
3. Injetar esse `id` (ou o `title`) como mensagem do usuário para a IA.
    * *Dica*: Para a IA, tratar o clique como se o usuário tivesse digitado o texto do botão (ex: "Sim"), mas com a certeza da intenção (pelo ID).

---

## 5. Próximos Passos para Implementação

1. **Refatorar `IAMia`**: Adicionar os métodos construtores de JSON para `list` e `button`.
2. **Mapear Intenções**: Identificar no prompt do sistema ou na lógica de controle quais momentos devem disparar interatividade.
3. **Atualizar Webhook**: Garantir que o parser de entrada suporte `messages[0]['interactive']`.
4. **Testes**: Validar envio e recebimento com números de teste cadastrados na Meta.
