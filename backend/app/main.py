from fastapi import (
    FastAPI,
    BackgroundTasks,
    UploadFile,
    File,
    Body,
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
import smtplib
import poplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
import pytz

# Armazenamento temporário para arquivos da IA
TEMP_DIR = "/tmp/cms_ai_files"
os.makedirs(TEMP_DIR, exist_ok=True)

app = FastAPI()


# Origens padrão para desenvolvimento e produção
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://cms-frontend-424v.onrender.com",
    "https://gerenciamentocms.app.br",
    "https://www.gerenciamentocms.app.br",
]

# Ler do env ou usar padrões
# Parsing robusto: divisão por vírgula, remoção de espaços e vazios
cors_origins_str = os.getenv("CORS_ORIGINS", "")
env_origins = []
if cors_origins_str and cors_origins_str.strip():
    env_origins = [
        origin.strip() for origin in cors_origins_str.split(",") if origin.strip()
    ]

# Mesclar padrões com origens do env para garantir segurança
origins = list(set(DEFAULT_ORIGINS + env_origins))

print(f"CORS Origins Configured: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.run\.app",  # Permitir todos os subdomínios do Cloud Run
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/")
def read_root():
    return {"message": "Backend is running", "status": "ok"}


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
    # Usar o ID fornecido como ID do documento
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

    # Consulta Base
    works_ref = db.collection("works")

    # Aplicar Filtros
    if regional and regional.strip():
        works_ref = works_ref.where("regional", "==", regional.strip())

    # Pesquisa (limitada ao Prefixo na regional para otimização ou apenas buscar tudo se a pesquisa for pesada?
    # Firestore não suporta 'contains'. Por enquanto, aplicamos offset/limit.
    # Se um termo de pesquisa for genérico, podemos perder dados se pesquisarmos apenas na primeira página.
    # TODO: Implementar mecanismo de busca de texto completo (ex: Algolia ou coleção especializada)
    # Por enquanto, aplicamos paginação ao resultado filtrado.

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

    # 2. Verificações de Relação Otimizadas (Apenas para obras buscadas)
    work_ids = [w["id"] for w in works_list]

    # Verificação em lote para existência onde ID == WorkID (relações 1:1)
    # criar referências
    plan_refs = [db.collection("plannings").document(wid) for wid in work_ids]
    mgmt_refs = [db.collection("managements").document(wid) for wid in work_ids]
    team_refs = [db.collection("team").document(wid) for wid in work_ids]

    # get_all é eficiente para leituras em massa
    plan_snaps = db.get_all(plan_refs)
    mgmt_snaps = db.get_all(mgmt_refs)
    team_snaps = db.get_all(team_refs)

    plannings_map = {snap.id: snap.exists for snap in plan_snaps}
    managements_map = {snap.id: snap.exists for snap in mgmt_snaps}
    team_map = {snap.id: snap.exists for snap in team_snaps}

    # Torre de Controle / OCs (Um-para-Muitos: Obra -> OCs)
    # Otimização: Verificar se ALGUMA OC existe para essas obras.
    # A consulta 'in' do Firestore suporta até 10 (ou 30) valores. Se limite > 10, executar em blocos.
    ocs_work_ids = set()

    # Processar em blocos de 10 para consultas 'in'
    chunk_size = 10
    for i in range(0, len(work_ids), chunk_size):
        chunk = work_ids[i : i + chunk_size]
        # Precisamos apenas saber se pelo menos uma existe.
        # Esta consulta busca todas as OCs para essas obras. Pesado se houver muitas OCs, mas melhor que TODAS as OCs.
        # select([]) minimiza a largura de banda.
        ocs_query = (
            db.collection("ocs")
            .where("work_id", "in", chunk)
            .select(["work_id"])
            .stream()
        )
        for d in ocs_query:
            # Apenas precisamos marcar o work_id como tendo uma OC
            data = d.to_dict()
            if "work_id" in data:
                ocs_work_ids.add(data["work_id"])

    # 3. Mapear Flags
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

    # 1. Deletar Obra
    db.collection("works").document(work_id).delete()

    # 2. Deletar Planejamento Vinculado (ID é work_id)
    db.collection("plannings").document(work_id).delete()

    # 3. Deletar Gerenciamento Vinculado (ID é work_id)
    db.collection("managements").document(work_id).delete()

    # 4. Deletar OCs (e seus eventos)
    # Nota: Para consistência estrita, deveríamos usar um batch, mas simplificado aqui para deleções independentes
    ocs = db.collection("ocs").where("work_id", "==", work_id).stream()
    for oc in ocs:
        # Deletar eventos vinculados a esta OC
        events = db.collection("oc_events").where("oc_id", "==", oc.id).stream()
        for evt in events:
            evt.reference.delete()
        # Deletar a própria OC
        oc.reference.delete()

    # 5. Deletar Ocorrências
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
    """Adiciona uma atribuição de residente a uma obra"""
    db = firestore.client()
    doc_ref = db.collection("works").document(work_id)

    doc_ref.update({"residents": firestore.ArrayUnion([assignment.dict()])})
    return {"message": "Resident assigned successfully"}


# --- Eventos ---


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


# --- Fornecedores ---


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


# --- Ocorrências (Atividades) ---


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


# --- Equipe ---


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


# --- Torre de Controle (OCs) ---


class OCCreate(BaseModel):
    work_id: str
    type: str
    description: str
    value: float = 0.0
    details: str = ""


@app.post("/ocs")
def create_oc(oc: OCCreate, current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    # Gerar ID automaticamente para OCs ou usar uma estratégia específica?
    # Por enquanto, deixando o Firestore gerar o ID usando .add() em vez de .document().set()
    # Ou podemos criar um UUID. Vamos usar .add() que retorna uma tupla (update_time, doc_ref)
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


# --- Torre de Controle (Eventos) ---


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


# --- Definições de Eventos (Modelos) ---


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
    # Usar work_id como ID do documento para fácil busca 1:1, forçando strip para evitar duplicatas
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


# --- Gestão de Engenharia ---


class ManagementItem(BaseModel):
    name: str
    date: str = ""
    status: str = "⚪️"  # Padrão círculo cinza


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


class EngineeringCapexItem(BaseModel):
    planned: str = ""
    approved: str = ""
    contracted: str = ""


class DailyLogItem(BaseModel):
    day: str
    date: str = ""
    effective: str = ""  # Int como string para evitar problemas com 0
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
    # Novos campos
    operator: str = ""
    size_m2: str = ""
    floor_size_m2: str = ""
    engineer: str = ""
    coordinator: str = ""
    control_tower: str = ""
    pm: str = ""
    cm: str = ""
    # Campos de apresentação
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

    # Cronogramas
    macro_schedule: List[ScheduleItem] = []
    supply_schedule: List[ScheduleItem] = []
    # Informações Avançadas
    complementary_info: List[ComplementaryInfoItem] = []
    general_docs: GeneralDocItem = GeneralDocItem()
    capex: EngineeringCapexItem = EngineeringCapexItem()
    daily_log: List[DailyLogItem] = []
    highlights: HighlightsItem = HighlightsItem()


@app.post("/managements")
def create_management(
    management: ManagementCreate, current_user: dict = Depends(get_current_user)
):
    db = firestore.client()
    # Usar work_id como chave para tornar a conexão 1-para-1 facilmente recuperável
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
    return {}  # Retornar vazio se não encontrado, filtros do frontend lidarão com a inicialização


@app.get("/managements")
def get_all_managements(current_user: dict = Depends(get_current_user)):
    db = firestore.client()
    docs = db.collection("managements").stream()
    managements = []
    for doc in docs:
        data = doc.to_dict()
        # Garantir que work_id esteja presente (deveria estar, mas apenas por precaução)
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
    # Usar work_id como ID do documento para relacionamento 1:1, ou auto-id se 1:N
    # Assumindo 1 Planejamento por Obra por enquanto, usar work_id é mais seguro
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

        # Buscar Detalhes da Obra para o Cabeçalho
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
        # Passar nome do usuário e configuração para serviço
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
        file_ext = os.path.splitext(file.filename or "")[1]
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
    """Tarefa em segundo plano para remover arquivo após o download"""
    try:
        os.remove(path)
        print(f"Deleted temp file: {path}")
    except Exception as e:
        print(f"Error deleting temp file {path}: {e}")


@app.get("/ai/download/{file_id}")
def download_file(file_id: str, background_tasks: BackgroundTasks):
    # Segurança: Garantir que file_id seja apenas UUID/alfanumérico para evitar travessia de caminho
    # Verificação simples: UUIDs não possuem barras
    if "/" in file_id or "\\" in file_id:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    # Buscamos o arquivo com qualquer extensão no TEMP_DIR correspondente ao ID
    found_file = None
    for f in os.listdir(TEMP_DIR):
        if f.startswith(file_id):
            found_file = f
            break

    if not found_file:
        raise HTTPException(status_code=404, detail="File not found or expired")

    file_path = os.path.join(TEMP_DIR, found_file)

    # Agendar exclusão após resposta
    background_tasks.add_task(remove_file, file_path)

    return FileResponse(
        path=file_path,
        filename=found_file,  # Usuário verá este nome (ou poderíamos armazenar o nome original no DB, mas simplificado por enquanto)
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
    """Criar um novo item de backlog"""
    db = firestore.client()
    # Definir created_at se não estiver presente
    if not item.created_at:
        # Formato: dd/mm/aaaa às hh:mm:ss
        now = datetime.now()
        item.created_at = now.strftime("%d/%m/%Y às %H:%M:%S")

    # Definir created_by
    item.created_by = current_user.get("name", "Usuário Desconhecido")

    doc_ref = db.collection("backlog_items").document(item.id)
    doc_ref.set(item.dict())
    return item


@app.get("/backlog-items")
async def get_backlog_items(current_user: dict = Depends(get_current_user)):
    """Obter todos os itens de backlog"""
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
    """Deletar um item de backlog por ID"""
    try:
        db = firestore.client()
        # Verificar se item existe
        doc_ref = db.collection("backlog_items").document(item_id)
        doc = doc_ref.get()
        if not doc.exists:
            # Já deletado? Retornar sucesso ou 404.
            # Para idempotência, sucesso é melhor, mas usuário pode ficar confuso se esperava que existisse.
            # No entanto, neste caso de condição de corrida de clique duplo, retornar 200 ou 404 é melhor que 500.
            # Vamos retornar 404 como "Não Encontrado" é semanticamente correto, mas tratamos a causa 500.
            raise HTTPException(status_code=404, detail="Item não encontrado")

        # Deletar item
        doc_ref.delete()
        return {"message": "Item deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/backlog-items/{item_id}")
async def update_backlog_item(item_id: str, item: BacklogItem):
    """Atualizar um item de backlog"""
    db = firestore.client()
    doc_ref = db.collection("backlog_items").document(item_id)
    doc_ref.set(item.dict())
    return item


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
    """Criar um novo residente"""
    db = firestore.client()
    doc_ref = db.collection("residents").document(resident.id)
    doc_ref.set(resident.dict())
    return resident


@app.get("/residents")
async def get_residents():
    """Obter todos os residentes"""
    db = firestore.client()
    docs = db.collection("residents").stream()
    residents = []
    for doc in docs:
        residents.append(doc.to_dict())
    return residents


@app.post("/works/{work_id}/assignments/{resident_id}/evaluate")
async def evaluate_resident(work_id: str, resident_id: str, evaluation: Evaluation):
    """Avaliar um residente em uma obra"""
    db = firestore.client()

    # 1. Atualizar Atribuição de Obra
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

    # 2. Atualizar Métricas Agregadas do Residente
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

        # Calcular nova média
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
    """Remover uma atribuição de residente de uma obra"""
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
    """Deletar um residente"""
    db = firestore.client()
    doc_ref = db.collection("residents").document(resident_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Resident not found")

    doc_ref.delete()
    return {"message": "Resident deleted successfully"}


@app.put("/residents/{resident_id}")
async def update_resident(resident_id: str, resident: Resident):
    """Atualizar um residente"""
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
    # Permissões
    allow_quantity_change: bool = False
    allow_add_items: bool = False
    allow_remove_items: bool = False
    allow_lpu_edit: bool = False

    # Campos da Fase 2 (Cotação)
    status: Optional[str] = "draft"  # draft, waiting, submitted
    quote_token: Optional[str] = None
    invited_suppliers: Optional[List[dict]] = []  # [{id, name}]
    quote_permissions: Optional[dict] = None

    # Novo Campo para Filtragem
    selected_items: Optional[List[str]] = []

    # Dados
    prices: Optional[dict] = {}
    quantities: Optional[dict] = {}


@app.post("/lpus")
async def create_lpu(lpu: LPU, current_user: dict = Depends(get_current_user)):
    """Criar uma nova LPU"""
    db = firestore.client()

    # Verificar se a obra existe
    work_ref = db.collection("works").document(lpu.work_id)
    if not work_ref.get().exists:
        raise HTTPException(status_code=404, detail="Work not found")

    # Definir created_at se não estiver presente
    if not lpu.created_at:
        now = datetime.now()
        lpu.created_at = now.strftime("%d/%m/%Y às %H:%M:%S")

    doc_ref = db.collection("lpus").document(lpu.id)
    doc_ref.set(lpu.dict())
    return lpu


@app.get("/lpus")
async def get_lpus(current_user: dict = Depends(get_current_user)):
    """Obter todas as LPUs"""
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
    """Atualizar uma LPU"""
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
    """Deletar uma LPU"""
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
    print(
        f"[AI ENHANCE] Recebida requisição - Text length: {len(req.text)}, Context: {req.context}"
    )
    print(f"[AI ENHANCE] User: {current_user.get('email', 'unknown')}")

    try:
        resultado = enhance_text(req.text, req.context)
        print(
            f"[AI ENHANCE] Resposta gerada com sucesso - Length: {len(resultado) if resultado else 0}"
        )
        return {"formatted_text": resultado}
    except Exception as e:
        print(f"[AI ENHANCE] ERRO: {type(e).__name__}: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao processar IA: {str(e)}")


# --- Supplier Public Access ---


class SupplierLoginRequest(BaseModel):
    token: str
    cnpj: str


@app.post("/public/supplier/login")
def supplier_login(req: SupplierLoginRequest):
    db = firestore.client()

    # 1. Encontrar LPU pelo Token
    lpus_ref = db.collection("lpus")
    query = lpus_ref.where("quote_token", "==", req.token).limit(1)
    docs = query.stream()

    lpu_data = None
    lpu_doc_id = None

    for doc in docs:
        lpu_data = doc.to_dict()
        lpu_doc_id = doc.id
        # Limite 1
        break

    if not lpu_data:
        raise HTTPException(
            status_code=404, detail="Cotação não encontrada ou token inválido."
        )

    # 2. Verificar CNPJ do Fornecedor
    # Normalizar CNPJ de entrada (remover símbolos)
    input_cnpj = "".join(filter(str.isdigit, req.cnpj))

    # Verificar se este CNPJ existe na coleção de fornecedores para pegar o ID
    # Armazenar fornecedores geralmente com símbolos ou sem? Devemos verificar ambos ou assumir normalização.
    # Por segurança, vamos buscar CNPJ correspondente se possível.
    # Se o armazenamento variar, isso é complicado. Vamos assumir que a entrada corresponde ao armazenamento por enquanto ou tentar limpar.
    # Melhor estratégia: Obter todos os IDs convidados da LPU, então buscar esses fornecedores e verificar CNPJ.

    invited_suppliers = lpu_data.get("invited_suppliers", [])  # List of {id, name}
    if not invited_suppliers:
        raise HTTPException(
            status_code=403, detail="Esta cotação não possui fornecedores convidados."
        )

    is_authorized = False

    # Otimização: Se a lista for pequena, buscar todos os fornecedores convidados
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

    # 3. Retornar Dados da LPU
    # Incluir ID na resposta
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

    # 1. Verificar LPU e Token
    doc_ref = db.collection("lpus").document(lpu_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="LPU not found")

    lpu_data = doc.to_dict()
    if lpu_data.get("quote_token") != req.token:
        raise HTTPException(status_code=403, detail="Token inválido")

    # 2. Verificar Status
    if lpu_data.get("status") == "submitted":
        raise HTTPException(status_code=400, detail="Esta cotação já foi enviada.")

    # 3. Encontrar Nome do Fornecedor pelo CNPJ (para manutenção de registros)
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

    # 4. Atualizar com Metadados
    from datetime import datetime

    # Usar UTC para armazenamento, explicitamente marcado com Z
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

    # Snapshot do estado atual para histórico
    # Apenas snapshot se houver dados submetidos reais
    current_history = lpu_data.get("history", [])

    # Se status for submitted, salvamos o estado atual como uma revisão
    if lpu_data.get("status") == "submitted":
        snapshot = {
            "prices": lpu_data.get("prices", {}),
            "quantities": lpu_data.get("quantities", {}),
            "submission_metadata": lpu_data.get("submission_metadata", {}),
            "created_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            "revision_number": len(current_history) + 1,
        }
        current_history.append(snapshot)

    # Redefinir para nova revisão
    doc_ref.update(
        {
            "status": "waiting",
            "history": current_history,
            "revision_comment": req.comment,
            "prices": {},  # Limpar atual
            "quantities": {},  # Limpar atual
            "submission_metadata": firestore.DELETE_FIELD,  # Remover metadados
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
        # Manter o histórico, mas atualizar o estado atual para coincidir com a revisão aprovada

    doc_ref.update(updates)
    return {"message": "LPU approved", "restored_revision": req.revision_number}


# --- Email Verification ---


class EmailConfig(BaseModel):
    email: str
    password: str


@app.post("/verify-email")
def verify_email(config: EmailConfig, current_user: dict = Depends(get_current_user)):
    """
    Verifica as credenciais de e-mail em postmail.cmseng.com.br
    SMTP: 465 (SSL)
    POP3: 995 (SSL)
    """
    SERVER = "postmail.cmseng.com.br"
    SMTP_PORT = 465
    POP_PORT = 995
    email = config.email
    password = config.password

    # 1. Verificar SMTP (Envio)
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SERVER, SMTP_PORT, context=context) as server:
            server.login(email, password)
            # Apenas o login é suficiente para verificar as credenciais
    except Exception as e:
        print(f"SMTP Verification Failed: {e}")
        raise HTTPException(
            status_code=400, detail=f"Falha na autenticação SMTP (Envio): {str(e)}"
        )

    # 2. Verificar POP3 (Recebimento)
    try:
        # POP3_SSL padrão é porta 995
        server = poplib.POP3_SSL(SERVER, POP_PORT)
        server.user(email)
        server.pass_(password)
        server.quit()
    except Exception as e:
        print(f"POP3 Verification Failed: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Falha na autenticação POP3 (Recebimento): {str(e)}",
        )

    # Se ambos passarem, salvar no Firestore para este contexto de usuário/tenant
    # Geralmente isso é uma configuração global ou por usuário. Assumindo global por enquanto ou específica do usuário?
    # Requisito: "o usuário insira só o email e a senha".
    # Vamos apenas verificar aqui. O salvamento pode ser feito pelo frontend em um documento específico,
    # ou podemos verificar E salvar aqui.
    # Vamos apenas retornar sucesso para verificação, o frontend salva nas Configurações do Firestore.

    return {"message": "Credenciais verificadas com sucesso!", "valid": True}


@app.on_event("startup")
async def startup_event():
    print("STARTUP EVENT TRIGGERED", flush=True)  # DEBUG
    try:
        initialize_firebase()
        # Iniciar Agendador em Segundo Plano
        print("Starting scheduler task...", flush=True)  # DEBUG
        asyncio.create_task(scheduler_loop())
    except Exception as e:
        print(f"ERROR: Failed to initialize Firebase or Scheduler: {e}", flush=True)


async def scheduler_loop():
    """
    Tarefa em Segundo Plano: Verifica a cada 60s por e-mails agendados.
    """
    # Fuso Horário BRT
    tz = pytz.timezone("America/Sao_Paulo")

    print("[SCHEDULER] Started email scheduler loop.", flush=True)

    while True:
        try:
            now = datetime.now(tz)
            current_date_str = now.strftime("%Y-%m-%d")
            current_time_str = now.strftime("%H:%M")

            # Consulta básica: Obter todos os E-mails Agendados que NÃO estão 'sent' (enviados)
            # Otimização: Em um app real, indexaríamos por data/status.
            # Aqui assumindo que o volume é baixo o suficiente para filtrar em memória ou consulta simples.
            # Consulta Firestore: where('status', '!=', 'sent') requer um índice se misturado com outros campos.
            # Vamos tentar obter todos e filtrar.

            db = firestore.client()
            # Nota: nome da coleção deve coincidir com o frontend: "scheduled_emails"
            docs = db.collection("scheduled_emails").stream()

            for doc in docs:
                data = doc.to_dict()
                email_id = doc.id

                # Verificar Status
                status = data.get("status", "pending")  # Padrão para pending se ausente
                print(
                    f"[SCHEDULER] Checking {email_id}: Date={data.get('date')} Time={data.get('time')} Status={status}",
                    flush=True,
                )

                if status == "sent":
                    continue

                # Verificar Data e Hora
                DATE = data.get("date")  # "YYYY-MM-DD"
                TIME = data.get("time", "08:00")  # "HH:mm"

                if not DATE:
                    continue

                # Comparar:
                # Se Data < Hoje: Atrasado, enviar.
                # Se Data == Hoje: Verificar Hora.
                # Se Data > Hoje: Aguardar.

                should_send = False
                if DATE < current_date_str:
                    should_send = True
                elif DATE == current_date_str:
                    if TIME <= current_time_str:
                        should_send = True

                if should_send:
                    print(
                        f"[SCHEDULER] Sending email {email_id} - Scheduled: {DATE} {TIME}"
                    )
                    try:
                        # Enviar Email
                        await send_email_internal(data)

                        # Verificar recorrência
                        recurrence = data.get("recurrence", "none")

                        if recurrence and recurrence != "none":
                            # Calcular próxima data de envio
                            from datetime import timedelta
                            from dateutil.relativedelta import relativedelta

                            current_scheduled = datetime.strptime(DATE, "%Y-%m-%d")

                            if recurrence == "weekly":
                                next_date = current_scheduled + timedelta(days=7)
                            elif recurrence == "biweekly":
                                next_date = current_scheduled + timedelta(days=14)
                            elif recurrence == "monthly":
                                next_date = current_scheduled + relativedelta(months=1)
                            else:
                                next_date = current_scheduled

                            # Atualizar para próxima ocorrência
                            db.collection("scheduled_emails").document(email_id).update(
                                {
                                    "date": next_date.strftime("%Y-%m-%d"),
                                    "lastSentAt": now.isoformat(),
                                    "status": "pending",  # Manter pending para próxima execução
                                }
                            )
                            print(
                                f"[SCHEDULER] Email {email_id} sent. Next occurrence: {next_date.strftime('%Y-%m-%d')}"
                            )
                        else:
                            # Email único: marcar como enviado
                            db.collection("scheduled_emails").document(email_id).update(
                                {"status": "sent", "sentAt": now.isoformat()}
                            )
                            print(f"[SCHEDULER] Email {email_id} sent and marked.")

                    except Exception as e:
                        print(f"[SCHEDULER] Failed to send email {email_id}: {e}")
                        # Opcional: incrementar contagem de tentativas ou marcar como erro

        except Exception as e:
            print(f"[SCHEDULER] Error in loop: {e}")

        await asyncio.sleep(60)


async def send_email_internal(data: dict):
    """
    Lógica reutilizável para enviar e-mail.
    Suporta lista de 'recipients' ou 'recipientEmail' legado.
    """
    recipients = data.get("recipients", [])  # List of {email, name}
    recipient_email_legacy = data.get("recipientEmail")

    # Normalizar lista de destinatários
    final_recipients = []

    if recipients and isinstance(recipients, list) and len(recipients) > 0:
        for r in recipients:
            if isinstance(r, dict) and "email" in r:
                final_recipients.append(r["email"])

    if not final_recipients and recipient_email_legacy:
        final_recipients.append(recipient_email_legacy)

    if not final_recipients:
        print("[SCHEDULER] No recipients found for email.")
        return  # Nothing to do

    subject = data.get("title")
    body = data.get("body")
    sender_email = data.get("senderEmail")
    sender_password = data.get("senderPassword")

    # Reutilizar a lógica de determinação de credenciais
    SERVER = "postmail.cmseng.com.br"
    PORT = 465

    # Determinar lógica de credenciais igual ao endpoint
    if not sender_email or not sender_password:
        try:
            db = firestore.client()
            settings_doc = db.collection("settings").document("email_config").get()
            if settings_doc.exists:
                g_data = settings_doc.to_dict()
                if not sender_email:
                    sender_email = g_data.get("email")
                if not sender_password:
                    sender_password = g_data.get("password")
        except Exception as e:
            print(f"Error fetching global email settings: {e}")

    if not sender_email or not sender_password:
        raise Exception("Missing credentials")

    # Executar SMTP síncrono
    loop = asyncio.get_event_loop()

    print(
        f"[SCHEDULER] Sending email '{subject}' to {len(final_recipients)} recipients.",
        flush=True,
    )

    for to_email in final_recipients:
        try:
            msg = MIMEMultipart()
            msg["From"] = sender_email
            msg["To"] = to_email
            msg["Subject"] = subject

            content = body.replace("\n", "<br>")
            html_body = f"""
            <html>
                <body>
                    <p>{content}</p>
                    <br>
                    <hr>
                    <p style="font-size: 10px; color: gray;">Enviado via Portal CMS (Automático)</p>
                </body>
            </html>
            """
            msg.attach(MIMEText(html_body, "html"))

            await loop.run_in_executor(
                None,
                _send_smtp_sync,
                SERVER,
                PORT,
                sender_email,
                sender_password,
                to_email,
                msg.as_string(),
            )
            print(f"[SCHEDULER] Sent to {to_email}", flush=True)

        except Exception as e:
            print(f"[SCHEDULER] Failed to send to {to_email}: {e}", flush=True)


def _send_smtp_sync(server_host, port, user, password, to_email, msg_str):
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(server_host, port, context=context) as server:
        server.login(user, password)
        server.sendmail(user, to_email, msg_str)


class RecipientModel(BaseModel):
    email: str
    name: Optional[str] = None


class CustomEmailRequest(BaseModel):
    # Suporte tanto a único quanto múltiplos
    recipient_email: Optional[str] = None
    recipients: Optional[List[RecipientModel]] = []
    subject: str
    body: str
    sender_email: Optional[str] = None
    sender_password: Optional[str] = None


@app.post("/send-custom-email")
async def send_custom_email(
    request: CustomEmailRequest, current_user: dict = Depends(get_current_user)
):
    """
    Envia um e-mail personalizado usando credenciais fornecidas ou padrão via SMTP/SSL 465.
    """
    # Mapear requisição para formato de dicionário interno
    data = {
        "recipientEmail": request.recipient_email,
        "recipients": [r.dict() for r in request.recipients]
        if request.recipients
        else [],
        "title": request.subject,
        "body": request.body,
        "senderEmail": request.sender_email,
        "senderPassword": request.sender_password,
    }

    try:
        await send_email_internal(data)
        return {"message": "Email enviado com sucesso!"}
    except Exception as e:
        print(f"Send Email Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao enviar email: {str(e)}")
