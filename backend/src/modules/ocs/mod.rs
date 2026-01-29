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
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OC {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>, // ID gerado pelo Firestore ou retornado na leitura
    pub work_id: String,
    #[serde(rename = "type")]
    pub type_: String, // "type" é palavra reservada em Rust
    pub description: String,
    #[serde(default)]
    pub value: f64,
    #[serde(default)]
    pub details: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_ocs).post(create_oc))
        .route("/:id", get(get_oc).put(update_oc).delete(delete_oc))
}

async fn list_ocs(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "ocs";
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<OC>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let ocs: Vec<OC> = stream.collect().await;
            Json::<Vec<OC>>(ocs).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar OCs: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar OCs").into_response()
        }
    }
}

async fn create_oc(
    State(state): State<AppState>,
    Json(mut payload): Json<OC>,
) -> impl IntoResponse {
    let collection = "ocs";
    let id = Uuid::new_v4().to_string();
    payload.id = Some(id.clone());
    
    let res: Result<OC, _> = state.db
        .fluent()
        .insert()
        .into(collection)
        .document_id(&id)
        .object(&payload)
        .execute()
        .await;

    match res {
        Ok(_) => (StatusCode::CREATED, Json(payload)).into_response(),
        Err(e) => {
            tracing::error!("Erro ao criar OC: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao criar OC").into_response()
        }
    }
}

async fn get_oc(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "ocs";
    let res: firestore::FirestoreResult<Option<OC>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<OC>()
        .one(&id)
        .await;

    match res {
        Ok(Some(oc)) => Json::<OC>(oc).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "OC não encontrada").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar OC: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_oc(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<OC>,
) -> impl IntoResponse {
    let collection = "ocs";
    
    let res: Result<OC, _> = state.db
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
            tracing::error!("Erro ao atualizar OC: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_oc(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "ocs";
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
            tracing::error!("Erro ao deletar OC: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
