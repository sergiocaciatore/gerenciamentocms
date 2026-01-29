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

// Estruturas de Dados (Baseadas no main.py lines 800+)

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Planning {
    pub work_id: String,
    #[serde(default)]
    pub status: String,
    pub data: Option<serde_json::Value>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_plannings).post(create_planning))
        .route("/:id", get(get_planning).put(update_planning).delete(delete_planning))
}

async fn list_plannings(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "plannings";
    
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<Planning>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let plannings: Vec<Planning> = stream.collect().await;
            Json::<Vec<Planning>>(plannings).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar planejamentos: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar planejamentos").into_response()
        }
    }
}

async fn create_planning(
    State(state): State<AppState>,
    Json(payload): Json<Planning>,
) -> impl IntoResponse {
    let collection = "plannings";
    
    // Planning usa work_id como ID do documento (relação 1:1 com Work)
    let res: Result<Planning, _> = state.db
        .fluent()
        .insert()
        .into(collection)
        .document_id(&payload.work_id) 
        .object(&payload)
        .execute()
        .await;

    match res {
        Ok(_) => (StatusCode::CREATED, Json(payload)).into_response(),
        Err(e) => {
            tracing::error!("Erro ao criar planejamento: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao salvar planejamento").into_response()
        }
    }
}

async fn get_planning(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "plannings";
    let res: firestore::FirestoreResult<Option<Planning>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<Planning>()
        .one(&id)
        .await;

    match res {
        Ok(Some(plan)) => Json::<Planning>(plan).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Planejamento não encontrado").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar planejamento: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_planning(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<Planning>,
) -> impl IntoResponse {
    let collection = "plannings";
    
    let res: Result<Planning, _> = state.db
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
            tracing::error!("Erro ao atualizar planejamento: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_planning(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "plannings";
    
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
            tracing::error!("Erro ao deletar planejamento: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
