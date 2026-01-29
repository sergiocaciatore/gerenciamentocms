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
pub struct OCEvent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub description: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub status: Option<String>,
    pub protocol: Option<String>,
    pub oc_id: String,
    #[serde(default)]
    pub status_options: Vec<String>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_oc_events).post(create_oc_event))
        .route("/:id", get(get_oc_event).put(update_oc_event).delete(delete_oc_event))
}

async fn list_oc_events(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "oc_events";
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<OCEvent>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let events: Vec<OCEvent> = stream.collect().await;
            Json::<Vec<OCEvent>>(events).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar eventos de OC: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar eventos").into_response()
        }
    }
}

async fn create_oc_event(
    State(state): State<AppState>,
    Json(mut payload): Json<OCEvent>,
) -> impl IntoResponse {
    let collection = "oc_events";
    let id = Uuid::new_v4().to_string();
    payload.id = Some(id.clone());
    
    let res: Result<OCEvent, _> = state.db
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
            tracing::error!("Erro ao criar evento de OC: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao criar evento").into_response()
        }
    }
}

async fn get_oc_event(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "oc_events";
    let res: firestore::FirestoreResult<Option<OCEvent>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<OCEvent>()
        .one(&id)
        .await;

    match res {
        Ok(Some(evt)) => Json::<OCEvent>(evt).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Evento não encontrado").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar evento: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_oc_event(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<OCEvent>,
) -> impl IntoResponse {
    let collection = "oc_events";
    
    let res: Result<OCEvent, _> = state.db
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
            tracing::error!("Erro ao atualizar evento: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_oc_event(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "oc_events";
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
            tracing::error!("Erro ao deletar evento: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
