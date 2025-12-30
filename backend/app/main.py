from fastapi import (
    FastAPI,
    BackgroundTasks,
    UploadFile,
    File,
    Body,
    Depends,
    Depends,
    HTTPException,
)
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.auth.deps import get_current_user
from app.auth.firebase import initialize_firebase
from pydantic import BaseModel
from firebase_admin import firestore
from typing import List, Optional
from app.services.ai_service import chat_with_data, enhance_text
from datetime import datetime
import os
import uuid
import shutil

# Temp storage for AI files
TEMP_DIR = "/tmp/cms_ai_files"
os.makedirs(TEMP_DIR, exist_ok=True)

app = FastAPI()


@app.on_event("startup")
def startup_event():
    initialize_firebase()


# Default origins for development and production
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://cms-frontend-424v.onrender.com",
    "https://gerenciamentocms.app.br",
    "https://www.gerenciamentocms.app.br",
]

# Read from env or use defaults
# Read from env or use defaults
# Parsing robusto: split por virgula, strip de espacos, remove vazios
cors_origins_str = os.getenv("CORS_ORIGINS", "")
env_origins = []
if cors_origins_str and cors_origins_str.strip():
    env_origins = [
        origin.strip() for origin in cors_origins_str.split(",") if origin.strip()
    ]

# MERGE defaults with env origins to ensure safely
origins = list(set(DEFAULT_ORIGINS + env_origins))

print(f"CORS Origins Configured: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/health")
def health_check():
    return {"ok": True}


@app.get("/me")
def read_users_me(current_user: dict = Depends(get_current_user)):
    return {
        "uid": current_user.get("uid"),
        "email": current_user.get("email"),
        "name": current_user.get("name"),
        "picture": current_user.get("picture"),
        "tenant_id": "mel",
        "roles": ["user"],
    }


@app.get("/cep/{cep}")
async def get_cep(cep: str):
    import httpx

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(f"https://brasilapi.com.br/api/cep/v2/{cep}")
        if response.status_code == 200:
            return response.json()
        return {"error": "CEP not found"}


class AddressModel(BaseModel):
    street: str
    neighborhood: str
    city: str
    state: str
    number: str
    complement: str


class Evaluation(BaseModel):
    technical: int
    management: int
    leadership: int
    organization: int
    commitment: int
    communication: int


class ResidentAssignment(BaseModel):
    id: str
    name: str
    contract_start: str
    contract_end: str
    evaluation: Optional[Evaluation] = None


class WorkCreate(BaseModel):
    id: str
    regional: str
    go_live_date: str
    cep: str
    address: AddressModel
    work_type: str
    cnpj: str
    business_case: str
    capex_approved: str
    internal_order: str
    oi: str
    residents: List[ResidentAssignment] = []


@app.post("/works")
def create_work(work: WorkCreate, current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    # Use the provided ID as the document ID
    doc_ref = db.collection("works").document(work.id)
    doc_ref.set(work.dict())
    return {"message": "Work created successfully", "id": work.id}


@app.get("/works")
def get_works(
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    regional: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = firestore.client()

    # Base Query
    works_ref = db.collection("works")

    # Appply Filters
    if regional and regional.strip():
        works_ref = works_ref.where("regional", "==", regional.strip())

    # Search (limited to Prefix on regional for optimization or just fetch all if search is heavy?
    # Firestore doesn't support 'contains'. For now, let's apply offset/limit.
    # If a search term is generic, we might miss data if we only search the first page.
    # TODO: Implement full text search engine (e.g. Algolia or specialized collection)
    # For now, we apply pagination to the filtered result.

    works_ref = works_ref.limit(limit).offset(offset)
    works_docs = works_ref.stream()

    works_list = []
    for doc in works_docs:
        w = doc.to_dict()
        if "id" not in w:
            w["id"] = doc.id
        works_list.append(w)

    if not works_list:
        return []

    # 2. Optimized Relation Checks (Only for fetched works)
    work_ids = [w["id"] for w in works_list]

    # Batch check for existence where ID == WorkID (1:1 relations)
    # create references
    plan_refs = [db.collection("plannings").document(wid) for wid in work_ids]
    mgmt_refs = [db.collection("managements").document(wid) for wid in work_ids]
    team_refs = [db.collection("team").document(wid) for wid in work_ids]

    # getAll is efficient for bulk reads
    plan_snaps = db.get_all(plan_refs)
    mgmt_snaps = db.get_all(mgmt_refs)
    team_snaps = db.get_all(team_refs)

    plannings_map = {snap.id: snap.exists for snap in plan_snaps}
    managements_map = {snap.id: snap.exists for snap in mgmt_snaps}
    team_map = {snap.id: snap.exists for snap in team_snaps}

    # Control Tower / OCs (One-to-Many: Work -> OCs)
    # Optimization: Check if ANY OC exists for these works.
    # Firestore 'in' query supports up to 10 (or 30) values. If limit > 10, run in chunks.
    ocs_work_ids = set()

    # Process in chunks of 10 for 'in' queries
    chunk_size = 10
    for i in range(0, len(work_ids), chunk_size):
        chunk = work_ids[i : i + chunk_size]
        # We only need to know if at least one exists.
        # This query gets all OCs for these works. Heavy if many OCs, but better than ALL OCs.
        # select([]) minimizes bandwidth.
        ocs_query = (
            db.collection("ocs")
            .where("work_id", "in", chunk)
            .select(["work_id"])
            .stream()
        )
        for d in ocs_query:
            # We just need to mark the work_id as having an OC
            data = d.to_dict()
            if "work_id" in data:
                ocs_work_ids.add(data["work_id"])

    # 3. Map Flags
    for work in works_list:
        wid = work["id"]
        work["has_engineering"] = team_map.get(wid, False)
        work["has_planning"] = plannings_map.get(wid, False)
        work["has_report"] = managements_map.get(wid, False)
        work["has_control_tower"] = wid in ocs_work_ids

    return works_list


@app.delete("/works/{work_id}")
def delete_work(work_id: str, current_user: dict = Depends(get_current_user)):
    db = firestore.client()

    # 1. Delete Work
    db.collection("works").document(work_id).delete()

    # 2. Delete Linked Planning (ID is work_id)
    db.collection("plannings").document(work_id).delete()

    # 3. Delete Linked Management (ID is work_id)
    db.collection("managements").document(work_id).delete()

    # 4. Delete OCs (and their events)
    # Note: For strict consistency we should use a batch, but simplified here for independent deletes
    ocs = db.collection("ocs").where("work_id", "==", work_id).stream()
    for oc in ocs:
        # Delete linked events for this OC
        events = db.collection("oc_events").where("oc_id", "==", oc.id).stream()
        for evt in events:
            evt.reference.delete()
        # Delete the OC itself
        oc.reference.delete()

    # 5. Delete Occurrences
    occurrences = db.collection("occurrences").where("work_id", "==", work_id).stream()
    for occ in occurrences:
        occ.reference.delete()

    return {"message": "Work and all associated data deleted successfully"}


@app.put("/works/{work_id}")
def update_work(
    work_id: str, work: WorkCreate, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    doc_ref = db.collection("works").document(work_id)
    doc_ref.set(work.dict())
    return {"message": "Work updated successfully"}


@app.post("/works/{work_id}/assignments")
async def add_resident_assignment(work_id: str, assignment: ResidentAssignment):
    """Add a resident assignment to a work"""
    db = firestore.client()
    doc_ref = db.collection("works").document(work_id)

    doc_ref.update({"residents": firestore.ArrayUnion([assignment.dict()])})
    return {"message": "Resident assigned successfully"}


# --- Events ---


class EventCreate(BaseModel):
    id: str
    description: str
    type: str
    sla: int


@app.post("/events")
def create_event(event: EventCreate, current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    doc_ref = db.collection("events").document(event.id)
    doc_ref.set(event.dict())
    return {"message": "Event created successfully", "id": event.id}


@app.get("/events")
def get_events(current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    events_ref = db.collection("events")
    docs = events_ref.stream()
    events = []
    for doc in docs:
        events.append(doc.to_dict())
    return events


@app.put("/events/{event_id}")
def update_event(
    event_id: str, event: EventCreate, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    doc_ref = db.collection("events").document(event_id)
    doc_ref.set(event.dict())
    return {"message": "Event updated successfully"}


@app.delete("/events/{event_id}")
def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    doc_ref = db.collection("events").document(event_id)
    doc_ref.delete()
    return {"message": "Event deleted successfully"}


# --- Suppliers ---


class SupplierCreate(BaseModel):
    id: str
    social_reason: str
    cnpj: str
    contract_start: str
    contract_end: str
    project: str
    hiring_type: str
    headquarters: str
    legal_representative: str
    representative_email: str
    contact: str
    witness: str
    witness_email: str
    observations: str


@app.post("/suppliers")
def create_supplier(
    supplier: SupplierCreate, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    doc_ref = db.collection("suppliers").document(supplier.id)
    doc_ref.set(supplier.dict())
    return {"message": "Supplier created successfully", "id": supplier.id}


@app.get("/suppliers")
def get_suppliers(current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    suppliers_ref = db.collection("suppliers")
    docs = suppliers_ref.stream()
    suppliers = []
    for doc in docs:
        suppliers.append(doc.to_dict())
    return suppliers


@app.put("/suppliers/{supplier_id}")
def update_supplier(
    supplier_id: str,
    supplier: SupplierCreate,
    current_user: dict = Depends(get_current_user),
):
    db = firestore.client()
    doc_ref = db.collection("suppliers").document(supplier_id)
    doc_ref.set(supplier.dict())
    return {"message": "Supplier updated successfully"}


@app.delete("/suppliers/{supplier_id}")
def delete_supplier(supplier_id: str, current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    doc_ref = db.collection("suppliers").document(supplier_id)
    doc_ref.delete()
    return {"message": "Supplier deleted successfully"}


# --- Occurrences (Ativities) ---


class OccurrenceCreate(BaseModel):
    id: str
    work_id: str
    date: str
    description: str
    type: str  # "Atividade", "Fato Relevante", etc.
    status: str = "Active"


@app.post("/occurrences")
def create_occurrence(
    occurrence: OccurrenceCreate, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    doc_ref = db.collection("occurrences").document(occurrence.id)
    doc_ref.set(occurrence.dict())
    return {"message": "Occurrence created successfully", "id": occurrence.id}


@app.get("/occurrences")
def get_occurrences(current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    occurrences_ref = db.collection("occurrences")
    docs = occurrences_ref.stream()
    occurrences = []
    for doc in docs:
        occurrences.append(doc.to_dict())
    return occurrences


@app.put("/occurrences/{occurrence_id}")
def update_occurrence(
    occurrence_id: str,
    occurrence: OccurrenceCreate,
    current_user: dict = Depends(get_current_user),
):
    db = firestore.client()
    doc_ref = db.collection("occurrences").document(occurrence_id)
    doc_ref.set(occurrence.dict())
    return {"message": "Occurrence updated successfully"}


@app.delete("/occurrences/{occurrence_id}")
def delete_occurrence(
    occurrence_id: str, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    doc_ref = db.collection("occurrences").document(occurrence_id)
    doc_ref.delete()
    return {"message": "Occurrence deleted successfully"}


# --- Team ---


class TeamMemberCreate(BaseModel):
    id: str
    name: str
    role: str


@app.post("/team")
def create_team_member(
    member: TeamMemberCreate, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    doc_ref = db.collection("team").document(member.id)
    doc_ref.set(member.dict())
    return {"message": "Team member created successfully", "id": member.id}


@app.get("/team")
def get_team(current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    team_ref = db.collection("team")
    docs = team_ref.stream()
    team = []
    for doc in docs:
        team.append(doc.to_dict())
    return team


@app.put("/team/{member_id}")
def update_team_member(
    member_id: str,
    member: TeamMemberCreate,
    current_user: dict = Depends(get_current_user),
):
    db = firestore.client()
    doc_ref = db.collection("team").document(member_id)
    doc_ref.set(member.dict())
    return {"message": "Team member updated successfully"}


@app.delete("/team/{member_id}")
def delete_team_member(member_id: str, current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    doc_ref = db.collection("team").document(member_id)
    doc_ref.delete()
    return {"message": "Team member deleted successfully"}


# --- Control Tower (OCs) ---


class OCCreate(BaseModel):
    work_id: str
    type: str
    description: str
    value: float = 0.0
    details: str = ""


@app.post("/ocs")
def create_oc(oc: OCCreate, current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    # Auto-generate ID for OCs or use a specific strategy?
    # For now, letting Firestore generate the ID by using .add() instead of .document().set()
    # Or we can create a UUID. Let's use .add() which returns a tuple (update_time, doc_ref)
    update_time, doc_ref = db.collection("ocs").add(oc.dict())
    return {"message": "OC created successfully", "id": doc_ref.id}


@app.get("/ocs")
def get_ocs(current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    ocs_ref = db.collection("ocs")
    docs = ocs_ref.stream()
    ocs = []
    for doc in docs:
        oc_data = doc.to_dict()
        oc_data["id"] = doc.id
        ocs.append(oc_data)
    return ocs


@app.put("/ocs/{oc_id}")
def update_oc(
    oc_id: str,
    oc: OCCreate,
    current_user: dict = Depends(get_current_user),
):
    db = firestore.client()
    doc_ref = db.collection("ocs").document(oc_id)
    doc_ref.set(oc.dict())
    return {"message": "OC updated successfully"}


@app.delete("/ocs/{oc_id}")
def delete_oc(oc_id: str, current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    doc_ref = db.collection("ocs").document(oc_id)
    doc_ref.delete()
    return {"message": "OC deleted successfully"}


# --- Control Tower (Events) ---


class OCEventCreate(BaseModel):
    description: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    protocol: Optional[str] = None
    oc_id: str
    status_options: List[str] = []


@app.post("/oc-events")
def create_oc_event(
    event: OCEventCreate, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    update_time, doc_ref = db.collection("oc_events").add(event.dict())
    return {"message": "OC Event created successfully", "id": doc_ref.id}


@app.get("/oc-events")
def get_oc_events(current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    events_ref = db.collection("oc_events")
    docs = events_ref.stream()
    events = []
    for doc in docs:
        event_data = doc.to_dict()
        event_data["id"] = doc.id
        events.append(event_data)
    return events


@app.put("/oc-events/{event_id}")
def update_oc_event(
    event_id: str,
    event: OCEventCreate,
    current_user: dict = Depends(get_current_user),
):
    db = firestore.client()
    doc_ref = db.collection("oc_events").document(event_id)
    doc_ref.set(event.dict())
    return {"message": "OC Event updated successfully"}


@app.delete("/oc-events/{event_id}")
def delete_oc_event(event_id: str, current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    doc_ref = db.collection("oc_events").document(event_id)
    doc_ref.delete()
    return {"message": "OC Event deleted successfully"}


# --- Event Definitions (Templates) ---


class EventDefinitionCreate(BaseModel):
    description: str
    default_status_options: List[str] = []
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    protocol: Optional[str] = None


@app.post("/event-definitions")
def create_event_definition(
    definition: EventDefinitionCreate, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    update_time, doc_ref = db.collection("event_definitions").add(definition.dict())
    return {"message": "Event Definition created successfully", "id": doc_ref.id}


@app.get("/event-definitions")
def get_event_definitions(current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    defs_ref = db.collection("event_definitions")
    docs = defs_ref.stream()
    definitions = []
    for doc in docs:
        def_data = doc.to_dict()
        def_data["id"] = doc.id
        definitions.append(def_data)
    return definitions


@app.put("/event-definitions/{def_id}")
def update_event_definition(
    def_id: str,
    definition: EventDefinitionCreate,
    current_user: dict = Depends(get_current_user),
):
    db = firestore.client()
    doc_ref = db.collection("event_definitions").document(def_id)
    doc_ref.set(definition.dict())
    return {"message": "Event Definition updated successfully"}


@app.delete("/event-definitions/{def_id}")
def delete_event_definition(
    def_id: str, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    doc_ref = db.collection("event_definitions").document(def_id)
    doc_ref.delete()
    return {"message": "Event Definition deleted successfully"}


# --- Project Avoidance ---


class CapexItem(BaseModel):
    id: str
    value: float
    created_at: str
    description: str = "Novo Capex"


class RequestItem(BaseModel):
    id: str
    date: str
    description: str
    responsible: str
    value: float


class ProjectAvoidanceCreate(BaseModel):
    work_id: str
    status: str = "Active"
    capex_items: List[CapexItem] = []
    requests: List[RequestItem] = []


@app.post("/project-avoidances")
def create_project_avoidance(
    item: ProjectAvoidanceCreate, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    # Use work_id as document ID for easy 1:1 lookup, enforcing strip to avoid duplicates
    clean_id = item.work_id.strip()
    doc_ref = db.collection("project_avoidances").document(clean_id)
    doc_ref.set(item.dict(), merge=True)
    return {"message": "Project Avoidance created successfully", "id": clean_id}


@app.get("/project-avoidances")
def get_project_avoidances(current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    docs = db.collection("project_avoidances").stream()
    items = []
    for doc in docs:
        data = doc.to_dict()
        if "work_id" not in data:
            data["work_id"] = doc.id
        items.append(data)
    return items


@app.put("/project-avoidances/{work_id}")
def update_project_avoidance(
    work_id: str,
    item: ProjectAvoidanceCreate,
    current_user: dict = Depends(get_current_user),
):
    db = firestore.client()
    doc_ref = db.collection("project_avoidances").document(work_id.strip())
    doc_ref.set(item.dict(), merge=True)
    return {"message": "Project Avoidance updated successfully"}


@app.delete("/project-avoidances/{work_id}")
def delete_project_avoidance(
    work_id: str, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    doc_ref = db.collection("project_avoidances").document(work_id.strip())
    doc_ref.delete()
    return {"message": "Project Avoidance deleted successfully"}


# --- Engineering Management ---


class ManagementItem(BaseModel):
    name: str
    date: str = ""
    status: str = "⚪️"  # Default to gray circle


class ThermometerItem(BaseModel):
    name: str
    status: str = "⚪️"


class ScheduleItem(BaseModel):
    name: str
    start_planned: str = ""
    start_real: str = ""
    end_planned: str = ""
    end_real: str = ""


class ComplementaryInfoItem(BaseModel):
    name: str
    date: str = ""
    status: str = "⚪️"


class GeneralDocItem(BaseModel):
    layout: str = ""
    construtora: str = ""
    contato: str = ""
    periodo_obra: str = ""
    data_inicio: str = ""
    data_termino: str = ""
    dias_pendentes: str = ""


class CapexItem(BaseModel):
    planned: str = ""
    approved: str = ""
    contracted: str = ""


class DailyLogItem(BaseModel):
    day: str
    date: str = ""
    effective: str = ""  # Int as string to avoid 0 issues
    weather: str = "☀️"
    production: str = "✅"


class HighlightsItem(BaseModel):
    special_attention: str = ""
    action_plans: str = ""
    relevant_activities: str = ""
    observations: str = ""


class MarcoItem(BaseModel):
    descricao: str = ""
    previsto: str = ""
    realizado: str = ""


class ManagementCreate(BaseModel):
    work_id: str
    owner_works: List[ManagementItem] = []
    licenses: List[ManagementItem] = []
    thermometer: List[ThermometerItem] = []
    # New fields
    operator: str = ""
    size_m2: str = ""
    floor_size_m2: str = ""
    engineer: str = ""
    coordinator: str = ""
    control_tower: str = ""
    pm: str = ""
    cm: str = ""
    # Presentation Fields
    presentation_highlights: str = ""
    attention_points: str = ""
    pp_destaques_executivos: str = ""
    pp_pontos_atencao: str = ""
    image_1: str = ""
    image_2: str = ""
    map_image: str = ""
    imovel_contrato_assinado: str = ""
    imovel_recebimento_contratual: str = ""
    imovel_entrega_antecipada: str = ""
    marcos: List[MarcoItem] = []

    # Schedules
    macro_schedule: List[ScheduleItem] = []
    supply_schedule: List[ScheduleItem] = []
    # Advanced Info
    complementary_info: List[ComplementaryInfoItem] = []
    general_docs: GeneralDocItem = GeneralDocItem()
    capex: CapexItem = CapexItem()
    daily_log: List[DailyLogItem] = []
    highlights: HighlightsItem = HighlightsItem()


@app.post("/managements")
def create_management(
    management: ManagementCreate, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    # Key by work_id to make it 1-to-1 connection easily retrievable
    doc_ref = db.collection("managements").document(management.work_id)
    doc_ref.set(management.dict())
    return {"message": "Management data saved successfully", "id": management.work_id}


@app.get("/managements/{work_id}")
def get_management(work_id: str, current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    doc_ref = db.collection("managements").document(work_id)
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return {}  # Return empty if not found, frontend filters will handle initialization


@app.get("/managements")
def get_all_managements(current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    docs = db.collection("managements").stream()
    managements = []
    for doc in docs:
        data = doc.to_dict()
        # Ensure work_id is present (it should be, but just in case)
        if "work_id" not in data:
            data["work_id"] = doc.id
        managements.append(data)
    return managements


# --- Planning ---


class PlanningCreate(BaseModel):
    work_id: str
    status: str = "Draft"
    data: Optional[dict] = {}


@app.post("/plannings")
def create_planning(
    planning: PlanningCreate, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    # Use work_id as the document ID for 1:1 relationship, or auto-id if 1:N
    # Assuming 1 Planning per Work for now, using work_id is safer
    doc_ref = db.collection("plannings").document(planning.work_id)
    doc_ref.set(planning.dict())
    return {"message": "Planning created successfully", "id": planning.work_id}


@app.get("/plannings")
def get_plannings(current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    plannings_ref = db.collection("plannings")
    docs = plannings_ref.stream()

    plannings = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id

        # Fetch Work Details for Header
        work_id = data.get("work_id")
        if work_id:
            work_ref = db.collection("works").document(work_id).get()
            if work_ref.exists:
                data["work"] = work_ref.to_dict()
                data["work"]["id"] = work_ref.id
        plannings.append(data)

    return plannings


@app.put("/plannings/{planning_id}")
def update_planning(
    planning_id: str,
    planning: PlanningCreate,
    current_user: dict = Depends(get_current_user),
):
    db = firestore.client()
    doc_ref = db.collection("plannings").document(planning_id)
    doc_ref.set(planning.dict())
    return {"message": "Planning updated successfully"}


@app.delete("/plannings/{planning_id}")
def delete_planning(planning_id: str, current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    doc_ref = db.collection("plannings").document(planning_id)
    doc_ref.delete()
    return {"message": "Planning deleted successfully"}


# --- AI Chat ---


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []
    config: Optional[dict] = {}


@app.post("/ai/chat")
def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    try:
        # Pass user name and config to service
        user_name = current_user.get("name", "Usuário")
        response_text, generated_files = chat_with_data(
            request.message, request.history, request.config, user_name
        )
        return {"response": response_text, "files": generated_files}
    except Exception as e:
        print(f"AI Error: {e}")
        return {
            "error": str(e),
            "response": "Desculpe, ocorreu um erro ao processar sua solicitação.",
        }


# --- File Handling ---


@app.post("/ai/upload")
async def upload_file(
    file: UploadFile = File(...), current_user: dict = Depends(get_current_user)
):
    try:
        file_id = str(uuid.uuid4())
        file_ext = os.path.splitext(file.filename)[1]
        stored_filename = f"{file_id}{file_ext}"
        file_path = os.path.join(TEMP_DIR, stored_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return {
            "file_id": file_id,
            "filename": file.filename,
            "stored_name": stored_filename,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def remove_file(path: str):
    """Background task to remove file after download"""
    try:
        os.remove(path)
        print(f"Deleted temp file: {path}")
    except Exception as e:
        print(f"Error deleting temp file {path}: {e}")


@app.get("/ai/download/{file_id}")
def download_file(file_id: str, background_tasks: BackgroundTasks):
    # Security: Ensure file_id is just UUID/alphanumeric to prevent path traversal
    # Simple check: UUIDs don't have slashes
    if "/" in file_id or "\\" in file_id:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    # We search for the file with any extension in TEMP_DIR matching the ID
    found_file = None
    for f in os.listdir(TEMP_DIR):
        if f.startswith(file_id):
            found_file = f
            break

    if not found_file:
        raise HTTPException(status_code=404, detail="File not found or expired")

    file_path = os.path.join(TEMP_DIR, found_file)

    # Schedule deletion after response
    background_tasks.add_task(remove_file, file_path)

    return FileResponse(
        path=file_path,
        filename=found_file,  # User will see this name (or we could store original name in DB, but simplistic for now)
        media_type="application/octet-stream",
    )


# --- Backlog ---


class BacklogAnnotation(BaseModel):
    date: str
    description: str


class TimelineEvent(BaseModel):
    date: str
    description: str
    status: str


class BacklogCompletion(BaseModel):
    date: str
    description: str


class BacklogItem(BaseModel):
    id: str
    work_id: str
    start_date: str
    sla: int
    description: str
    status: str
    has_timeline: bool
    annotations: List[BacklogAnnotation] = []
    timeline_events: Optional[List[TimelineEvent]] = None
    completion: Optional[BacklogCompletion] = None
    created_at: Optional[str] = None
    created_by: Optional[str] = None


@app.post("/backlog-items")
async def create_backlog_item(
    item: BacklogItem, current_user: dict = Depends(get_current_user)
):
    """Create a new backlog item"""
    db = firestore.client()
    # Set created_at if not present
    if not item.created_at:
        # Format: dd/mm/aaaa às hh:mm:ss
        now = datetime.now()
        item.created_at = now.strftime("%d/%m/%Y às %H:%M:%S")

    # Set created_by
    item.created_by = current_user.get("name", "Unknown User")

    doc_ref = db.collection("backlog_items").document(item.id)
    doc_ref.set(item.dict())
    return item


@app.get("/backlog-items")
async def get_backlog_items(current_user: dict = Depends(get_current_user)):
    """Get all backlog items"""
    db = firestore.client()
    docs = db.collection("backlog_items").stream()
    items = []
    for doc in docs:
        data = doc.to_dict()
        if "id" not in data:
            data["id"] = doc.id
        items.append(data)
    return items


@app.delete("/backlog-items/{item_id}")
async def delete_backlog_item(item_id: str):
    """Delete a backlog item by ID"""
    try:
        db = firestore.client()
        # Check if item exists
        doc_ref = db.collection("backlog_items").document(item_id)
        doc = doc_ref.get()
        if not doc.exists:
            # Already deleted? Return success or 404.
            # For idempotency, success is better, but user might be confused if they expected it to exist.
            # However, in this case of double-click race, returning 200 or 404 is better than 500.
            # Let's return 404 as "Not Found" is semantically correct, but we handle the 500 cause.
            raise HTTPException(status_code=404, detail="Item not found")

        # Delete item
        doc_ref.delete()
        return {"message": "Item deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/backlog-items/{item_id}")
async def update_backlog_item(item_id: str, item: BacklogItem):
    """Update a backlog item"""
    db = firestore.client()
    doc_ref = db.collection("backlog_items").document(item_id)
    doc_ref.set(item.dict())
    return item


class Evaluation(BaseModel):
    technical: int
    management: int
    leadership: int
    organization: int
    commitment: int
    communication: int


class Metrics(BaseModel):
    technical: float = 0.0
    management: float = 0.0
    leadership: float = 0.0
    organization: float = 0.0
    commitment: float = 0.0
    communication: float = 0.0
    count: int = 0


class Resident(BaseModel):
    id: str
    name: str
    email: str
    crea: str
    metrics: Metrics = Metrics()


@app.post("/residents")
async def create_resident(resident: Resident):
    """Create a new resident"""
    db = firestore.client()
    doc_ref = db.collection("residents").document(resident.id)
    doc_ref.set(resident.dict())
    return resident


@app.get("/residents")
async def get_residents():
    """Get all residents"""
    db = firestore.client()
    docs = db.collection("residents").stream()
    residents = []
    for doc in docs:
        residents.append(doc.to_dict())
    return residents


@app.post("/works/{work_id}/assignments/{resident_id}/evaluate")
async def evaluate_resident(work_id: str, resident_id: str, evaluation: Evaluation):
    """Evaluate a resident in a work"""
    db = firestore.client()

    # 1. Update Work Assignment
    work_ref = db.collection("works").document(work_id)
    work_doc = work_ref.get()

    if not work_doc.exists:
        raise HTTPException(status_code=404, detail="Work not found")

    work_data = work_doc.to_dict()
    residents = work_data.get("residents", [])

    updated_residents = []
    found = False
    for r in residents:
        if r.get("id") == resident_id:
            r["evaluation"] = evaluation.dict()
            found = True
        updated_residents.append(r)

    if not found:
        raise HTTPException(
            status_code=404, detail="Resident not assigned to this work"
        )

    work_ref.update({"residents": updated_residents})

    # 2. Update Resident Aggregated Metrics
    resident_ref = db.collection("residents").document(resident_id)
    resident_doc = resident_ref.get()

    if resident_doc.exists:
        res_data = resident_doc.to_dict()
        current_metrics = res_data.get(
            "metrics",
            {
                "technical": 0,
                "management": 0,
                "leadership": 0,
                "organization": 0,
                "commitment": 0,
                "communication": 0,
                "count": 0,
            },
        )

        count = current_metrics.get("count", 0)

        # Calculate new average
        new_count = count + 1
        new_metrics = {
            "technical": (
                current_metrics.get("technical", 0) * count + evaluation.technical
            )
            / new_count,
            "management": (
                current_metrics.get("management", 0) * count + evaluation.management
            )
            / new_count,
            "leadership": (
                current_metrics.get("leadership", 0) * count + evaluation.leadership
            )
            / new_count,
            "organization": (
                current_metrics.get("organization", 0) * count + evaluation.organization
            )
            / new_count,
            "commitment": (
                current_metrics.get("commitment", 0) * count + evaluation.commitment
            )
            / new_count,
            "communication": (
                current_metrics.get("communication", 0) * count
                + evaluation.communication
            )
            / new_count,
            "count": new_count,
        }

        resident_ref.update({"metrics": new_metrics})

    return {"message": "Evaluation saved successfully"}


@app.delete("/works/{work_id}/assignments/{resident_id}")
async def remove_resident_from_work(work_id: str, resident_id: str):
    """Remove a resident assignment from a work"""
    db = firestore.client()
    work_ref = db.collection("works").document(work_id)
    work_doc = work_ref.get()

    if not work_doc.exists:
        raise HTTPException(status_code=404, detail="Work not found")

    work_data = work_doc.to_dict()
    residents = work_data.get("residents", [])

    updated_residents = [r for r in residents if r.get("id") != resident_id]

    if len(residents) == len(updated_residents):
        raise HTTPException(status_code=404, detail="Resident not found in this work")

    work_ref.update({"residents": updated_residents})
    return {"message": "Resident removed from work successfully"}


@app.delete("/residents/{resident_id}")
async def delete_resident(resident_id: str):
    """Delete a resident"""
    db = firestore.client()
    doc_ref = db.collection("residents").document(resident_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Resident not found")

    doc_ref.delete()
    return {"message": "Resident deleted successfully"}


@app.put("/residents/{resident_id}")
async def update_resident(resident_id: str, resident: Resident):
    """Update a resident"""
    if resident_id != resident.id:
        raise HTTPException(status_code=400, detail="ID mismatch")

    db = firestore.client()
    doc_ref = db.collection("residents").document(resident_id)

    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Resident not found")

    doc_ref.set(resident.dict())
    return resident


# --- LPU (Lista de Preços Unitários) ---


class LPU(BaseModel):
    id: str
    work_id: str
    limit_date: str
    created_at: Optional[str] = None
    # Permissions
    allow_quantity_change: bool = False
    allow_add_items: bool = False
    allow_remove_items: bool = False
    allow_lpu_edit: bool = False

    # Phase 2 Fields (Quotation)
    status: Optional[str] = "draft"  # draft, waiting, submitted
    quote_token: Optional[str] = None
    invited_suppliers: Optional[List[dict]] = []  # [{id, name}]
    quote_permissions: Optional[dict] = None

    # New Field for Filtering
    selected_items: Optional[List[str]] = []

    # Data
    prices: Optional[dict] = {}
    quantities: Optional[dict] = {}


@app.post("/lpus")
async def create_lpu(lpu: LPU, current_user: dict = Depends(get_current_user)):
    """Create a new LPU"""
    db = firestore.client()

    # Check if work exists
    work_ref = db.collection("works").document(lpu.work_id)
    if not work_ref.get().exists:
        raise HTTPException(status_code=404, detail="Work not found")

    # Set created_at if not present
    if not lpu.created_at:
        now = datetime.now()
        lpu.created_at = now.strftime("%d/%m/%Y às %H:%M:%S")

    doc_ref = db.collection("lpus").document(lpu.id)
    doc_ref.set(lpu.dict())
    return lpu


@app.get("/lpus")
async def get_lpus(current_user: dict = Depends(get_current_user)):
    """Get all LPUs"""
    db = firestore.client()
    docs = db.collection("lpus").stream()
    lpus = []
    for doc in docs:
        lpus.append(doc.to_dict())
    return lpus


@app.put("/lpus/{lpu_id}")
async def update_lpu(
    lpu_id: str, lpu: LPU, current_user: dict = Depends(get_current_user)
):
    """Update an LPU"""
    if lpu_id != lpu.id:
        raise HTTPException(status_code=400, detail="ID mismatch")

    db = firestore.client()
    doc_ref = db.collection("lpus").document(lpu_id)

    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="LPU not found")

    doc_ref.set(lpu.dict())
    return lpu


@app.delete("/lpus/{lpu_id}")
async def delete_lpu(lpu_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an LPU"""
    db = firestore.client()
    doc_ref = db.collection("lpus").document(lpu_id)

    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="LPU not found")

    doc_ref.delete()
    return {"message": "LPU deleted successfully"}


class EnhanceRequest(BaseModel):
    text: str
    context: str = ""


@app.post("/ai/enhance")
def enhance_text_endpoint(
    req: EnhanceRequest, current_user: dict = Depends(get_current_user)
):
    return {"formatted_text": enhance_text(req.text, req.context)}


# --- Supplier Public Access ---


class SupplierLoginRequest(BaseModel):
    token: str
    cnpj: str


@app.post("/public/supplier/login")
def supplier_login(req: SupplierLoginRequest):
    db = firestore.client()

    # 1. Find LPU by Token
    lpus_ref = db.collection("lpus")
    query = lpus_ref.where("quote_token", "==", req.token).limit(1)
    docs = query.stream()

    lpu_data = None
    lpu_doc_id = None

    for doc in docs:
        lpu_data = doc.to_dict()
        lpu_doc_id = doc.id
        # Limit 1
        break

    if not lpu_data:
        raise HTTPException(
            status_code=404, detail="Cotação não encontrada ou token inválido."
        )

    # 2. Verify Supplier CNPJ
    # Normalize input CNPJ (remove symbols)
    input_cnpj = "".join(filter(str.isdigit, req.cnpj))

    # Check if this CNPJ exists in suppliers collection to get the ID
    # Store suppliers usually with symbols or without? We should check both or assume normalize.
    # To be safe, let's fetch matching CNPJ if possible.
    # If storage varies, this is tricky. Let's assume input matches storage for now or try to clean.
    # Better strategy: Get all invited IDs from LPU, then fetch those suppliers and check CNPJ.

    invited_suppliers = lpu_data.get("invited_suppliers", [])  # List of {id, name}
    if not invited_suppliers:
        raise HTTPException(
            status_code=403, detail="Esta cotação não possui fornecedores convidados."
        )

    is_authorized = False

    # Optimization: If list is small, fetch all invited suppliers
    for invited in invited_suppliers:
        sup_id = invited.get("id")
        if not sup_id:
            continue

        sup_doc = db.collection("suppliers").document(sup_id).get()
        if sup_doc.exists:
            sup_data = sup_doc.to_dict()
            stored_cnpj = sup_data.get("cnpj", "")
            stored_clean = "".join(filter(str.isdigit, stored_cnpj))

            if stored_clean == input_cnpj:
                is_authorized = True
                break

    if not is_authorized:
        raise HTTPException(
            status_code=403, detail="CNPJ não autorizado para esta cotação."
        )

    # 3. Return LPU Data
    # Include ID in response
    lpu_data["id"] = lpu_doc_id
    return lpu_data


class SupplierSubmitRequest(BaseModel):
    token: str
    cnpj: str
    signer_name: str
    prices: dict
    quantities: dict


@app.post("/public/supplier/lpus/{lpu_id}/submit")
def supplier_submit(lpu_id: str, req: SupplierSubmitRequest):
    db = firestore.client()

    # 1. Verify LPU & Token
    doc_ref = db.collection("lpus").document(lpu_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="LPU not found")

    lpu_data = doc.to_dict()
    if lpu_data.get("quote_token") != req.token:
        raise HTTPException(status_code=403, detail="Token inválido")

    # 2. Verify Status
    if lpu_data.get("status") == "submitted":
        raise HTTPException(status_code=400, detail="Esta cotação já foi enviada.")

    # 3. Find Supplier Name from CNPJ (for record keeping)
    input_cnpj = "".join(filter(str.isdigit, req.cnpj))
    supplier_name = "Fornecedor Desconhecido"

    invited_suppliers = lpu_data.get("invited_suppliers", [])
    for invited in invited_suppliers:
        sup_id = invited.get("id")
        if not sup_id:
            continue
        sup_doc = db.collection("suppliers").document(sup_id).get()
        if sup_doc.exists:
            sup_data = sup_doc.to_dict()
            stored_cnpj = sup_data.get("cnpj", "")
            stored_clean = "".join(filter(str.isdigit, stored_cnpj))
            if stored_clean == input_cnpj:
                supplier_name = sup_data.get("social_reason") or sup_data.get("name")
                break

    # 4. Update with Metadata
    from datetime import datetime

    # Use UTC for storage, explicitly marked with Z
    now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    doc_ref.update(
        {
            "prices": req.prices,
            "quantities": req.quantities,
            "status": "submitted",
            "submission_metadata": {
                "signer_name": req.signer_name,
                "submission_date": now,
                "supplier_name": supplier_name,
                "supplier_cnpj": req.cnpj,
            },
        }
    )

    return {"message": "Cotação enviada com sucesso"}


class RevisionRequest(BaseModel):
    comment: str


@app.post("/lpus/{lpu_id}/revision")
def create_revision(lpu_id: str, req: RevisionRequest):
    db = firestore.client()
    doc_ref = db.collection("lpus").document(lpu_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="LPU not found")

    lpu_data = doc.to_dict()

    # Snapshot current state to history
    # Only snapshot if there is actual submitted data
    current_history = lpu_data.get("history", [])

    # If status is submitted, we save the current state as a revision
    if lpu_data.get("status") == "submitted":
        snapshot = {
            "prices": lpu_data.get("prices", {}),
            "quantities": lpu_data.get("quantities", {}),
            "submission_metadata": lpu_data.get("submission_metadata", {}),
            "created_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            "revision_number": len(current_history) + 1,
        }
        current_history.append(snapshot)

    # Reset for new revision
    doc_ref.update(
        {
            "status": "waiting",
            "history": current_history,
            "revision_comment": req.comment,
            "prices": {},  # Clear current
            "quantities": {},  # Clear current
            "submission_metadata": firestore.DELETE_FIELD,  # Remove metadata
        }
    )

    return {"message": "New revision created"}


class ApproveRequest(BaseModel):
    revision_number: Optional[int] = None


@app.post("/lpus/{lpu_id}/approve")
def approve_lpu(lpu_id: str, req: ApproveRequest = Body(default=None)):
    if req is None:
        req = ApproveRequest()

    db = firestore.client()
    doc_ref = db.collection("lpus").document(lpu_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="LPU not found")

    updates = {"status": "approved"}

    if req.revision_number is not None:
        lpu_data = doc.to_dict()
        history = lpu_data.get("history", [])
        revision = next(
            (r for r in history if r.get("revision_number") == req.revision_number),
            None,
        )

        if not revision:
            raise HTTPException(
                status_code=404, detail=f"Revision {req.revision_number} not found"
            )

        updates["prices"] = revision.get("prices", {})
        updates["quantities"] = revision.get("quantities", {})
        updates["submission_metadata"] = revision.get("submission_metadata")
        # Keep the history, but update current state to match the approved revision

    doc_ref.update(updates)
    return {"message": "LPU approved", "restored_revision": req.revision_number}
