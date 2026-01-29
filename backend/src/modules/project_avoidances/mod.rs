use serde::{Deserialize, Serialize};
use firestore::FirestoreDb;
use axum::{
    routing::{get, post},
    Router,
    response::IntoResponse,
    Json,
    extract::{State, Path},
    http::StatusCode,
};
use crate::AppState;
use futures::stream::StreamExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapexItem {
    pub id: String,
    pub value: f64,
    pub created_at: String,
    #[serde(default = "default_capex_desc")]
    pub description: String,
}

fn default_capex_desc() -> String {
    "Novo Capex".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestItem {
    pub id: String,
    pub date: String,
    pub description: String,
    pub responsible: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectAvoidance {
    pub work_id: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub capex_items: Vec<CapexItem>,
    #[serde(default)]
    pub requests: Vec<RequestItem>,
}

fn default_status() -> String {
    "Active".to_string()
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_project_avoidances).post(create_project_avoidance))
        .route("/:work_id", get(get_project_avoidance).put(update_project_avoidance).delete(delete_project_avoidance))
}

async fn list_project_avoidances(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "project_avoidances";
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<ProjectAvoidance>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let mut items: Vec<ProjectAvoidance> = stream.collect().await;
            
            // Garantir work_id se faltar (se struct exigir, já falha ou vem default string vazia)
            // No caso de dados legados, o ID do documento é o work_id.
            // Para ser robusto, poderíamos iterar e setar work_id se estiver vazio.
            // Como String default é "", se vier vazio, podemos corrigir aqui?
            // Mas ProjectAvoidance tem campos públicos, podemos modificar.
            /* 
            for item in &mut items {
                if item.work_id.is_empty() {
                    // Como obter o ID do doc aqui? StreamObj não traz o ID separado facilmente sem wrapper.
                    // Assumiremos dados consistentes ou que o campo work_id está gravado no documento.
                }
            }
            */

            Json::<Vec<ProjectAvoidance>>(items).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar project avoidances: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar dados").into_response()
        }
    }
}

async fn create_project_avoidance(
    State(state): State<AppState>,
    Json(payload): Json<ProjectAvoidance>,
) -> impl IntoResponse {
    let collection = "project_avoidances";
    let doc_id = payload.work_id.trim().to_string(); // Strip whitespace
    
    // Usar work_id como chave
    let res: Result<ProjectAvoidance, _> = state.db
        .fluent()
        .insert()
        .into(collection)
        .document_id(&doc_id)
        .object(&payload)
        .execute()
        .await;

    match res {
        Ok(_) => (StatusCode::CREATED, Json(payload)).into_response(),
        Err(e) => {
            tracing::error!("Erro ao criar project avoidance: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao criar dados").into_response()
        }
    }
}

async fn get_project_avoidance(
    State(state): State<AppState>,
    Path(work_id): Path<String>,
) -> impl IntoResponse {
    let collection = "project_avoidances";
    let clean_id = work_id.trim();

    let res: firestore::FirestoreResult<Option<ProjectAvoidance>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<ProjectAvoidance>()
        .one(clean_id)
        .await;

    match res {
        Ok(Some(item)) => Json::<ProjectAvoidance>(item).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Project Avoidance não encontrado").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar project avoidance: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_project_avoidance(
    State(state): State<AppState>,
    Path(work_id): Path<String>,
    Json(payload): Json<ProjectAvoidance>,
) -> impl IntoResponse {
    let collection = "project_avoidances";
    let clean_id = work_id.trim();
    
    let res: Result<ProjectAvoidance, _> = state.db
        .fluent()
        .update()
        .in_col(collection)
        .document_id(clean_id)
        .object(&payload)
        .execute()
        .await;

    match res {
        Ok(_) => (StatusCode::OK, Json(payload)).into_response(),
        Err(e) => {
            tracing::error!("Erro ao atualizar project avoidance: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_project_avoidance(
    State(state): State<AppState>,
    Path(work_id): Path<String>,
) -> impl IntoResponse {
    let collection = "project_avoidances";
    let clean_id = work_id.trim();

    let res = state.db
        .fluent()
        .delete()
        .from(collection)
        .document_id(clean_id)
        .execute()
        .await;

    match res {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => {
            tracing::error!("Erro ao deletar project avoidance: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
