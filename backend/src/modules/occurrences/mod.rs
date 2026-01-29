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
pub struct Occurrence {
    pub id: String,
    pub work_id: String,
    pub date: String,
    pub description: String,
    #[serde(rename = "type")]
    pub event_type: String, // 'type' é palavra reservada em Rust
    #[serde(default = "default_status")]
    pub status: String,
}

fn default_status() -> String {
    "Active".to_string()
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_occurrences).post(create_occurrence))
        .route("/:id", get(get_occurrence).put(update_occurrence).delete(delete_occurrence))
}

async fn list_occurrences(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "occurrences";
    
    // Obter o stream de documentos
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<Occurrence>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            // Coletar o stream em um vetor
            let occurrences: Vec<Occurrence> = stream.collect().await;
            Json::<Vec<Occurrence>>(occurrences).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao iniciar stream de ocorrências: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar ocorrências").into_response()
        }
    }
}

async fn create_occurrence(
    State(state): State<AppState>,
    Json(payload): Json<Occurrence>,
) -> impl IntoResponse {
    let collection = "occurrences";
    
    // Salvar no Firestore usando o ID fornecido no payload
    let res: Result<Occurrence, _> = state.db
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
            tracing::error!("Erro ao criar ocorrência: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao salvar ocorrência").into_response()
        }
    }
}

async fn get_occurrence(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "occurrences";
    let res: firestore::FirestoreResult<Option<Occurrence>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<Occurrence>()
        .one(&id)
        .await;

    match res {
        Ok(Some(occ)) => Json::<Occurrence>(occ).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Ocorrência não encontrada").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar ocorrência: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_occurrence(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<Occurrence>,
) -> impl IntoResponse {
    let collection = "occurrences";
    
    // Firestore update
    let res: Result<Occurrence, _> = state.db
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
            tracing::error!("Erro ao atualizar ocorrência: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_occurrence(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "occurrences";
    
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
            tracing::error!("Erro ao deletar ocorrência: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
