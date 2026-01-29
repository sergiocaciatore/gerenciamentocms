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
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LPU {
    pub id: String,
    pub work_id: String,
    pub limit_date: String,
    pub created_at: Option<String>,
    #[serde(default)]
    pub allow_quantity_change: bool,
    #[serde(default)]
    pub allow_add_items: bool,
    #[serde(default)]
    pub allow_remove_items: bool,
    #[serde(default)]
    pub allow_lpu_edit: bool,
    #[serde(default = "default_status")]
    pub status: Option<String>,
    pub quote_token: Option<String>,
    pub invited_suppliers: Option<Vec<serde_json::Value>>, // [{id, name}] - usando Value pra simplificar ou Struct dedicada
    pub quote_permissions: Option<serde_json::Value>,
    #[serde(default)]
    pub selected_items: Option<Vec<String>>,
    pub prices: Option<HashMap<String, serde_json::Value>>, // pode ser complexo
    pub quantities: Option<HashMap<String, serde_json::Value>>,
}

fn default_status() -> Option<String> {
    Some("draft".to_string())
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_lpus).post(create_lpu))
        .route("/:id", get(get_lpu).put(update_lpu).delete(delete_lpu))
}

async fn list_lpus(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "lpus";
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<LPU>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let lpus: Vec<LPU> = stream.collect().await;
            Json::<Vec<LPU>>(lpus).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar LPUs: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar LPUs").into_response()
        }
    }
}

async fn create_lpu(
    State(state): State<AppState>,
    Json(mut payload): Json<LPU>,
) -> impl IntoResponse {
    let collection = "lpus";
    
    // Auto-set created_at if missing
    if payload.created_at.is_none() {
        let now = chrono::Local::now();
        payload.created_at = Some(now.format("%d/%m/%Y às %H:%M:%S").to_string());
    }

    let res: Result<LPU, _> = state.db
        .fluent()
        .insert()
        .into(collection)
        .document_id(&payload.id)
        .object(&payload)
        .execute()
        .await;

    match res {
        Ok(_) => (StatusCode::CREATED, Json(payload)).into_response(),
        Err(e) => {
            tracing::error!("Erro ao criar LPU: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao criar LPU").into_response()
        }
    }
}

async fn get_lpu(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "lpus";
    let res: firestore::FirestoreResult<Option<LPU>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<LPU>()
        .one(&id)
        .await;

    match res {
        Ok(Some(lpu)) => Json::<LPU>(lpu).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "LPU não encontrada").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar LPU: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_lpu(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<LPU>,
) -> impl IntoResponse {
    let collection = "lpus";
    
    // Validar ID mismatch
    if id != payload.id {
        return (StatusCode::BAD_REQUEST, "ID mismatch").into_response();
    }

    let res: Result<LPU, _> = state.db
        .fluent()
        .update()
        .in_col(collection)
        .document_id(&id)
        .object(&payload)
        .execute()
        .await;

    match res {
        Ok(_) => (StatusCode::OK, Json(payload)).into_response(),
        Err(e) => {
            tracing::error!("Erro ao atualizar LPU: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_lpu(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "lpus";
    let res = state.db
        .fluent()
        .delete()
        .from(collection)
        .document_id(&id)
        .execute()
        .await;

    match res {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => {
            tracing::error!("Erro ao deletar LPU: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
