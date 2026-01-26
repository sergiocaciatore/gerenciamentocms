from typing import Optional
from firebase_admin import firestore
import json


def get_all_works():
    # ... (same)
    """
    Busca uma lista de todas as obras do banco de dados.
    Retorna informações básicas: ID, regional, cidade, estado.
    """
    db = firestore.client()
    docs = db.collection("works").stream()
    works = []
    for doc in docs:
        data = doc.to_dict()
        address = data.get("address", {})
        works.append(
            {
                "id": doc.id,
                "regional": data.get("regional", "N/A"),
                "city": address.get("city", "N/A"),
                "state": address.get("state", "N/A"),
                "type": data.get("work_type", "N/A"),
                "status": "Active",  # Placeholder
            }
        )
    return json.dumps(works)


def get_work_details(work_id: str):
    """
    Busca detalhes completos de uma obra específica pelo ID.
    """
    db = firestore.client()
    doc_ref = db.collection("works").document(work_id)
    doc = doc_ref.get()

    if not doc.exists:
        return json.dumps({"error": f"Work with ID {work_id} not found."})

    return json.dumps(doc.to_dict(), default=str)


def get_work_planning(work_id: str):
    """
    Busca dados de planejamento para uma obra específica.
    """
    db = firestore.client()
    # O ID do planejamento é atualmente o mesmo que o ID da Obra em nossa lógica
    doc_ref = db.collection("plannings").document(work_id)
    doc = doc_ref.get()

    if not doc.exists:
        return json.dumps(
            {"status": "Not Started", "message": "No planning found for this work."}
        )

    return json.dumps(doc.to_dict(), default=str)


# Mapa de ferramentas disponíveis para o Serviço de IA usar

# --- Ferramentas de Arquivo ---

TEMP_DIR = "/tmp/cms_ai_files"


def get_file_content(file_id: str):
    """
    Lê o conteúdo de um arquivo enviado anteriormente.
    Use isso quando o usuário mencionar que enviou um arquivo ou enviar um file_id.
    """
    import os

    # Localizar arquivo
    found_file = None
    if os.path.exists(TEMP_DIR):
        for filename in os.listdir(TEMP_DIR):
            if filename.startswith(file_id):
                found_file = filename
                break

    if not found_file:
        return json.dumps({"error": "File not found or expired"})

    try:
        with open(
            os.path.join(TEMP_DIR, found_file), "r", encoding="utf-8", errors="ignore"
        ) as file_obj:
            content = file_obj.read()
        return json.dumps({"filename": found_file, "content": content})
    except Exception as e:
        return json.dumps({"error": f"Error reading file: {str(e)}"})


def create_report_file(filename: str, content: str):
    """
    Cria um arquivo de texto baixável (relatório, documento, código) para o usuário.
    Uso: Chame isso quando o usuário pedir para "criar um documento", "gerar um relatório" ou "salvar isso".
    Retorno: O file_id que permite ao usuário baixá-lo.
    """
    import os
    import uuid

    if not os.path.exists(TEMP_DIR):
        os.makedirs(TEMP_DIR)

    file_id = str(uuid.uuid4())
    # Garantir que o nome do arquivo tenha extensão
    if "." not in filename:
        filename += ".txt"

    storage_name = f"{file_id}_{filename}"
    path = os.path.join(TEMP_DIR, storage_name)

    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

        return json.dumps(
            {
                "status": "success",
                "file_id": file_id,
                "filename": filename,
                "type": "document_created",  # Sinal para o Serviço de IA extrair isso
            }
        )
    except Exception as e:
        return json.dumps({"error": f"Error writing file: {str(e)}"})


def get_lpu_data(work_id: Optional[str] = None):
    """
    Busca dados da LPU (Lista de Preços Unitários).
    """
    db = firestore.client()
    query = db.collection("lpus")
    if work_id:
        query = query.where("work_id", "==", work_id)

    docs = query.stream()
    data = [doc.to_dict() for doc in docs]
    return json.dumps(data, default=str)


def get_control_tower_data():
    """
    Busca dados da Torre de Controle (OCs e Eventos).
    """
    db = firestore.client()
    ocs_docs = db.collection("ocs").stream()
    events_docs = db.collection("oc_events").stream()

    ocs = [doc.to_dict() for doc in ocs_docs]
    events = [doc.to_dict() for doc in events_docs]

    return json.dumps({"ocs": ocs, "events": events}, default=str)


def get_team_members():
    """
    Busca detalhes sobre a equipe (Residentes/Engenheiros).
    """
    db = firestore.client()
    docs = db.collection("residents").stream()
    data = [doc.to_dict() for doc in docs]
    return json.dumps(data, default=str)


def get_managements(work_id: Optional[str] = None):
    """
    Busca dados de Gerenciamento/Relatórios.
    """
    db = firestore.client()
    query = db.collection("managements")
    if work_id:
        query = query.where("work_id", "==", work_id)

    docs = query.stream()
    data = [doc.to_dict() for doc in docs]
    return json.dumps(data, default=str)


def get_daily_logs(work_id: str, date: Optional[str] = None):
    """
    Busca Diários de Obra.
    """
    db = firestore.client()
    query = db.collection("daily_logs").where("workId", "==", work_id)
    if date:
        query = query.where("date", "==", date)

    docs = query.stream()
    data = [doc.to_dict() for doc in docs]
    return json.dumps(data, default=str)


AVAILABLE_TOOLS = {
    "get_all_works": get_all_works,
    "get_work_details": get_work_details,
    "get_work_planning": get_work_planning,
    "get_lpu_data": get_lpu_data,
    "get_control_tower_data": get_control_tower_data,
    "get_team_members": get_team_members,
    "get_managements": get_managements,
    "get_daily_logs": get_daily_logs,
    "get_file_content": get_file_content,
    "create_report_file": create_report_file,
}

# Definições de Ferramentas OpenAI
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_all_works",
            "description": "Obter uma lista de todas as obras/projetos com informações básicas de status.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_work_details",
            "description": "Obter informações detalhadas sobre uma obra específica por ID (endereço, datas, business case).",
            "parameters": {
                "type": "object",
                "properties": {
                    "work_id": {
                        "type": "string",
                        "description": "O ID da obra/projeto (ex: 'O-001')",
                    }
                },
                "required": ["work_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_work_planning",
            "description": "Obter dados de planejamento para uma obra específica.",
            "parameters": {
                "type": "object",
                "properties": {
                    "work_id": {
                        "type": "string",
                        "description": "O ID da obra/projeto",
                    }
                },
                "required": ["work_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_file_content",
            "description": "Ler conteúdo de um arquivo enviado. O usuário deve fornecer file_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_id": {
                        "type": "string",
                        "description": "O ID do arquivo para ler.",
                    }
                },
                "required": ["file_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_lpu_data",
            "description": "Obter dados da LPU (Lista de Preços Unitários), opcionalmente filtrados por work_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "work_id": {
                        "type": "string",
                        "description": "ID da obra opcional para filtrar itens da LPU.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_control_tower_data",
            "description": "Obter dados da Torre de Controle incluindo OCs (Ocorrências) e linha do tempo de Eventos.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_team_members",
            "description": "Obter lista de membros da equipe (Residentes, Engenheiros) e suas atribuições.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_managements",
            "description": "Obter relatórios gerenciais e dados de status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "work_id": {
                        "type": "string",
                        "description": "ID da obra opcional para filtrar relatórios.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_daily_logs",
            "description": "Obter diário de obra (Daily Logs).",
            "parameters": {
                "type": "object",
                "properties": {
                    "work_id": {"type": "string", "description": "O ID da obra."},
                    "date": {
                        "type": "string",
                        "description": "Data opcional (AAAA-MM-DD) para filtrar logs.",
                    },
                },
                "required": ["work_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_report_file",
            "description": "Criar/Salvar um arquivo (relatório, texto, código) para o usuário baixar.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Nome do arquivo (ex: 'relatorio_obra.txt')",
                    },
                    "content": {
                        "type": "string",
                        "description": "O conteúdo completo do texto do arquivo.",
                    },
                },
                "required": ["filename", "content"],
            },
        },
    },
]
