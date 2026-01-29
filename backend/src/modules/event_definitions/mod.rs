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
pub struct EventDefinition {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub description: String,
    #[serde(default)]
    pub default_status_options: Vec<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub status: Option<String>,
    pub protocol: Option<String>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_event_definitions).post(create_event_definition))
        .route("/:id", get(get_event_definition).put(update_event_definition).delete(delete_event_definition))
}

async fn list_event_definitions(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "event_definitions";
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<EventDefinition>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let definitions: Vec<EventDefinition> = stream.collect().await;
            Json::<Vec<EventDefinition>>(definitions).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar definições de eventos: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar definições").into_response()
        }
    }
}

async fn create_event_definition(
    State(state): State<AppState>,
    Json(mut payload): Json<EventDefinition>,
) -> impl IntoResponse {
    let collection = "event_definitions";
    let id = Uuid::new_v4().to_string();
    payload.id = Some(id.clone());
    
    let res: Result<EventDefinition, _> = state.db
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
            tracing::error!("Erro ao criar definição de evento: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao criar definição").into_response()
        }
    }
}

async fn get_event_definition(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "event_definitions";
    let res: firestore::FirestoreResult<Option<EventDefinition>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<EventDefinition>()
        .one(&id)
        .await;

    match res {
        Ok(Some(defn)) => Json::<EventDefinition>(defn).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Definição não encontrada").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar definição: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_event_definition(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<EventDefinition>,
) -> impl IntoResponse {
    let collection = "event_definitions";
    
    let res: Result<EventDefinition, _> = state.db
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
            tracing::error!("Erro ao atualizar definição: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_event_definition(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "event_definitions";
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
            tracing::error!("Erro ao deletar definição: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
