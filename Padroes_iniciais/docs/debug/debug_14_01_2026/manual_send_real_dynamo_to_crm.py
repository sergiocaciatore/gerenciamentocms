import json
import requests
from src_aws.dynamics.auth import get_apigee_token
from src_aws.dynamics.mapeamento import converter_lead_para_crm


def main():
    # 1. Carregar dump do DynamoDB
    try:
        # Caminho relativo assumindo execução da raiz
        with open("debug/debug_14_01_2026/dump_lead_new.json", "r") as f:
            data = json.load(f)
            item_raw = data.get("Item", {})
    except Exception as e:
        print(f"Erro ao ler arquivo: {e}")
        return

    # 2. Desserializar DynamoDB Low-Level JSON -> Python Dict
    def deserialize(value):
        if "S" in value:
            return value["S"]
        if "N" in value:
            return value[
                "N"
            ]  # number as string allows preserving precision, or int/float
        if "L" in value:
            return [deserialize(x) for x in value["L"]]
        if "M" in value:
            return {k: deserialize(v) for k, v in value["M"].items()}
        if "BOOL" in value:
            return value["BOOL"]
        if "NULL" in value:
            return None
        return value

    item_dict = {k: deserialize(v) for k, v in item_raw.items()}

    # 3. Extrair Campos para Conversão via Blob (Mais seguro)
    blob_sessao_str = item_dict.get("blob_sessao")
    campos_coletados = {}

    if blob_sessao_str:
        try:
            blob_data = json.loads(blob_sessao_str)
            campos_coletados = blob_data.get("campos_coletados", {})
            print(">>> Dados extraídos do blob_sessao com sucesso.")
        except Exception as e:
            print(f"Erro ao parsear blob: {e}")

    # Fallback para raiz se falhar blob (ou se blob não tiver)
    if not campos_coletados:
        print(">>> Blob falhou ou vazio, tentando raiz do item...")
        # A raiz tem campos misturados, mas o converter filtra pelo get()
        campos_coletados = item_dict

    if not campos_coletados:
        print("Campos coletados não encontrados/vazios.")
        return

    print(">>> Campos Coletados (Amostra):")
    print(
        json.dumps(
            {
                k: v
                for k, v in campos_coletados.items()
                if k in ["nome", "cnpj", "telefone"]
            },
            indent=2,
        )
    )

    # 4. Converter usando o Hotfix Local
    print("\n>>> Convertendo para Payload CRM (com Hotfix)...")
    try:
        # Passaremos blob_sessao=None para não duplicar, já que o dump mostrou que observacoes
        # já tem algum texto, mas o converter vai remontar.
        # A lambda original passa o blob se existir. Vamos passar para ser fiel.
        # Mas no payload corrigido, estamos pondo o CNPJ nas observações se houver.
        payload = converter_lead_para_crm(campos_coletados, blob_sessao=blob_sessao_str)

        print("Payload Gerado:")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Erro na conversão: {e}")
        return

    # 5. Enviar para Dynamics
    try:
        print("\n>>> Obtendo Token Apigee...")
        token = get_apigee_token()

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
        print(f"Erro no envio: {e}")


if __name__ == "__main__":
    main()
