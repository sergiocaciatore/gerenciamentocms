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
pub struct Event {
    pub id: String,
    pub description: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub sla: i32,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_events).post(create_event))
        .route("/:id", get(get_event).put(update_event).delete(delete_event))
}

async fn list_events(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "events";
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<Event>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let events: Vec<Event> = stream.collect().await;
            Json::<Vec<Event>>(events).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar eventos: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar eventos").into_response()
        }
    }
}

async fn create_event(
    State(state): State<AppState>,
    Json(payload): Json<Event>,
) -> impl IntoResponse {
    let collection = "events";
    
    let res: Result<Event, _> = state.db
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
            tracing::error!("Erro ao criar evento: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao criar evento").into_response()
        }
    }
}

async fn get_event(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "events";
    let res: firestore::FirestoreResult<Option<Event>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<Event>()
        .one(&id)
        .await;

    match res {
        Ok(Some(evt)) => Json::<Event>(evt).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Evento não encontrado").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar evento: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_event(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<Event>,
) -> impl IntoResponse {
    let collection = "events";
    
    let res: Result<Event, _> = state.db
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

async fn delete_event(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "events";
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
