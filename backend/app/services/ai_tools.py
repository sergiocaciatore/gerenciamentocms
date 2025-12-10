from firebase_admin import firestore
import json


def get_all_works():
    """
    Fetches a list of all works from the database.
    Returns basic info: ID, regional, city, state.
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
    Fetches full details for a specific work ID.
    """
    db = firestore.client()
    doc_ref = db.collection("works").document(work_id)
    doc = doc_ref.get()

    if not doc.exists:
        return json.dumps({"error": f"Work with ID {work_id} not found."})

    return json.dumps(doc.to_dict(), default=str)


def get_work_planning(work_id: str):
    """
    Fetches planning data for a specific work ID.
    """
    db = firestore.client()
    # Planning ID is currently same as Work ID in our logic
    doc_ref = db.collection("plannings").document(work_id)
    doc = doc_ref.get()

    if not doc.exists:
        return json.dumps(
            {"status": "Not Started", "message": "No planning found for this work."}
        )

    return json.dumps(doc.to_dict(), default=str)


# Map of available tools for the AI Service to use

# --- File Tools ---

TEMP_DIR = "/tmp/cms_ai_files"


def get_file_content(file_id: str):
    """
    Reads the content of a previously uploaded file.
    Use this when the user mentions they uploaded a file or sends a file_id.
    """
    import os

    # Locate file
    found_file = None
    if os.path.exists(TEMP_DIR):
        for f in os.listdir(TEMP_DIR):
            if f.startswith(file_id):
                found_file = f
                break

    if not found_file:
        return json.dumps({"error": "File not found or expired"})

    try:
        with open(
            os.path.join(TEMP_DIR, found_file), "r", encoding="utf-8", errors="ignore"
        ) as f:
            content = f.read()
        return json.dumps({"filename": found_file, "content": content})
    except Exception as e:
        return json.dumps({"error": f"Error reading file: {str(e)}"})


def create_report_file(filename: str, content: str):
    """
    Creates a downloadable text file (report, document, code) for the user.
    Usage: Call this when the user asks to "create a document", "generate a report", or "save this".
    Return: The file_id that enables the user to download it.
    """
    import os
    import uuid

    if not os.path.exists(TEMP_DIR):
        os.makedirs(TEMP_DIR)

    file_id = str(uuid.uuid4())
    # Ensure filename has extension
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
                "type": "document_created",  # Signal to AI Service to extract this
            }
        )
    except Exception as e:
        return json.dumps({"error": f"Error writing file: {str(e)}"})


AVAILABLE_TOOLS = {
    "get_all_works": get_all_works,
    "get_work_details": get_work_details,
    "get_work_planning": get_work_planning,
    "get_file_content": get_file_content,
    "create_report_file": create_report_file,
}

# OpenAI Tool Definitions
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_all_works",
            "description": "Get a list of all works/projects with basic status info.",
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
            "description": "Get detailed information about a specific work by ID (address, dates, business case).",
            "parameters": {
                "type": "object",
                "properties": {
                    "work_id": {
                        "type": "string",
                        "description": "The ID of the work/project (e.g., 'O-001')",
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
            "description": "Get the planning data for a specific work.",
            "parameters": {
                "type": "object",
                "properties": {
                    "work_id": {
                        "type": "string",
                        "description": "The ID of the work/project",
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
            "description": "Read content of an uploaded file. User must provide file_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_id": {
                        "type": "string",
                        "description": "The ID of the file to read.",
                    }
                },
                "required": ["file_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_report_file",
            "description": "Create/Save a file (report, text, code) for the user to download.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Name of the file (e.g. 'relatorio_obra.txt')",
                    },
                    "content": {
                        "type": "string",
                        "description": "The full text content of the file.",
                    },
                },
                "required": ["filename", "content"],
            },
        },
    },
]
