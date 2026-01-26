import os
import requests
import json
import logging

# Configuração de logs para ver o que está acontecendo
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Credenciais (Valores que estão no seu .env ou que você passou como corretos)
# Tentei preencher com os valores do seu .env atual para testarmos
APIGEE_KEY = (
    os.environ.get("APIGEE_NONPROD_KEY")
    or "In0f1cu0UVaGnTjRuDwiZrGRSpJWjCZaQAo3kYtQAZSBvq9E"
)
APIGEE_SECRET = (
    os.environ.get("APIGEE_NONPROD_SECRET")
    or "1jTWLelJ5pxREmmRKUaQqybPnh1jxigDQhB6mGEDMM1s9JDPtwcCTh6myRa3Tx5U"
)
APIGEE_TOKEN_URL = "https://api.mills.com.br/oauth2/token"  # PRD URL segundo suas msgs
# Se for DEV: "https://api-dev.mills.com.br/oauth2/token"


def testar_autenticacao():
    print(f"🔄 Testando autenticação em: {APIGEE_TOKEN_URL}")
    print(f"🔑 ID: {APIGEE_KEY[:3]}...")

    try:
        response = requests.post(
            APIGEE_TOKEN_URL,
            auth=(APIGEE_KEY, APIGEE_SECRET),
            data={"grant_type": "client_credentials"},
            timeout=10,
        )

        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            token = response.json().get("access_token")
            print(f"✅ SUCESSO! Token recebido: {token[:10]}...")
            return token
        else:
            print(f"❌ FALHA: {response.text}")
            return None

    except Exception as e:
        print(f"❌ ERRO DE CONEXÃO: {e}")
        return None


if __name__ == "__main__":
    testar_autenticacao()
