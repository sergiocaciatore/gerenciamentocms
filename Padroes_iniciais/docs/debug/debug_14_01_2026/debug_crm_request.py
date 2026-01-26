import json
import requests
import uuid
from src_aws.dynamics.auth import get_apigee_token

# Payload COM EMPRESA para testar valores
payload = {
    "id": str(uuid.uuid4()),
    "nome": "Oportunidade WhatsApp - Teste Valor",
    "assunto": "Cotação Plataforma Tesoura Elétrica - 5 m",
    "status": "aberto",
    "origem": "whatsapp",
    "unidade_negocio_interesse": {"codigo": "leves"},
    "unidade_negocio_proprietaria": {"codigo": "leves"},
    "local_demanda": {
        "municipio": {"nome": "São Paulo", "codigo_ibge": "0000000"},
        "estado": {"sigla": "SP"},
    },
    "contato": {
        "nome": "Rafael",
        "sobrenome": "Mendes Candido",
        "telefone": "(11) 95675-2844",
        "email": "rafael.mendes@mills.com.br",
    },
    "observacao": "Teste Debug Local",
    "consentimentoEnvioEmail": True,
    "aquecimento_lead": "quente",
    "possui_demanda_imediata": True,
    "empresa": {"cnpj": "19598467000103", "razao_social": "Teste do Rafael"},
    # TENTATIVA: Valor comum customizado
    "mills_tipodecliente": 918660000,
    "questionario_pre_venda": [
        {"ordem": "1", "pergunta": "Família", "resposta": "Tesoura"}
    ],
    "utms": {"termo": "teste-ia-whats"},
}

try:
    print(">>> Obtendo Token...")
    token = get_apigee_token()
    print(">>> Token OK.")

    url = "https://api.mills.com.br/domain/v1/negocios-potenciais"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    print(f">>> Enviando POST para {url}...")
    resp = requests.post(url, json=payload, headers=headers)

    print(f"\nStatus Code: {resp.status_code}")
    print("Response Body:")
    print(resp.text)

except Exception as e:
    print(f"Erro: {e}")
