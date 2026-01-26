import json
import logging
from urllib.parse import urlparse, parse_qsl


# Mock da lógica da Lambda (extraída de src_aws/lambda_mia_campanha.py)
def simular_processamento(dados):
    campos_para_salvar = {
        "nome": dados.get("nome"),
        "email": dados.get("email"),
        "whatsapp": dados.get("whatsapp"),
        "landing_page_url": dados.get("page_url"),
    }

    print(f"DEBUG: Dados Iniciais: {json.dumps(campos_para_salvar, indent=2)}")

    # 1. Extração URL
    try:
        if dados.get("page_url"):
            parsed = urlparse(dados.get("page_url"))
            params_url = dict(parse_qsl(parsed.query))
            print(f"DEBUG: Params extraídos da URL: {params_url}")
            campos_para_salvar.update(params_url)
    except Exception as e:
        print(f"ERRO Parse URL: {e}")

    # 2. Merge Body
    for k, v in dados.items():
        if k not in campos_para_salvar and v:
            campos_para_salvar[k] = v

    print(
        f"DEBUG: Dados Finais (Pré-Filtro): {json.dumps(campos_para_salvar, indent=2)}"
    )

    return campos_para_salvar


if __name__ == "__main__":
    # Caso 1: UTMs na page_url
    payload_url = {
        "whatsapp": "5511999999999",
        "page_url": "https://landingpage.com/?utm_source=google&utm_medium=cpc&utm_campaign=teste_url",
    }
    print("--- TESTE 1: UTMs na URL ---")
    res1 = simular_processamento(payload_url)
    if res1.get("utm_source") == "google":
        print("✅ SUCESSO: utm_source extraído da URL")
    else:
        print("❌ FALHA: utm_source NÃO extraído da URL")

    # Caso 2: UTMs no corpo do JSON (como o script JS faz)
    payload_body = {
        "whatsapp": "5511999999999",
        "page_url": "https://landingpage.com/",
        "utm_source": "facebook",
        "utm_medium": "banner",
    }
    print("\n--- TESTE 2: UTMs no Body ---")
    res2 = simular_processamento(payload_body)
    if res2.get("utm_source") == "facebook":
        print("✅ SUCESSO: utm_source extraído do Body")
    else:
        print("❌ FALHA: utm_source NÃO extraído do Body")
