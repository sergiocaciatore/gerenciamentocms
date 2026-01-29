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
pub struct BacklogAnnotation {
    pub date: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub date: String,
    pub description: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacklogCompletion {
    pub date: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacklogItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>, // Pode vir vazio na criação? Python diz item.id. Vamos assumir que vem ou geramos.
    pub work_id: String,
    pub start_date: String,
    pub sla: i32,
    pub description: String,
    pub status: String,
    pub has_timeline: bool,
    #[serde(default)]
    pub annotations: Vec<BacklogAnnotation>,
    #[serde(default)]
    pub timeline_events: Option<Vec<TimelineEvent>>,
    #[serde(default)]
    pub completion: Option<BacklogCompletion>,
    pub created_at: Option<String>,
    pub created_by: Option<String>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_backlog_items).post(create_backlog_item))
        .route("/:id", get(get_backlog_item).put(update_backlog_item).delete(delete_backlog_item))
}

async fn list_backlog_items(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "backlog_items";
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<BacklogItem>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let items: Vec<BacklogItem> = stream.collect().await;
            Json::<Vec<BacklogItem>>(items).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar itens de backlog: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar backlog").into_response()
        }
    }
}

async fn create_backlog_item(
    State(state): State<AppState>,
    Json(mut payload): Json<BacklogItem>,
) -> impl IntoResponse {
    let collection = "backlog_items";
    
    // Se ID não fornecido, gerar? Python model tem id: str.
    // O frontend provavelmente envia o ID ou espera geração.
    // Vamos garantir ID.
    let doc_id = if let Some(ref id) = payload.id {
        id.clone()
    } else {
        use uuid::Uuid;
        let id = Uuid::new_v4().to_string();
        payload.id = Some(id.clone());
        id
    };

    if payload.created_at.is_none() {
        let now = chrono::Local::now();
        payload.created_at = Some(now.format("%d/%m/%Y às %H:%M:%S").to_string());
    }
    
    // created_by seria token, mockado por enquanto ou via headers se tiver
    if payload.created_by.is_none() {
        payload.created_by = Some("Usuário (Rust)".to_string());
    }

    let res: Result<BacklogItem, _> = state.db
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
            tracing::error!("Erro ao criar item de backlog: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao criar item").into_response()
        }
    }
}

async fn get_backlog_item(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "backlog_items";
    let res: firestore::FirestoreResult<Option<BacklogItem>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<BacklogItem>()
        .one(&id)
        .await;

    match res {
        Ok(Some(item)) => Json::<BacklogItem>(item).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Item não encontrado").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar item de backlog: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_backlog_item(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<BacklogItem>,
) -> impl IntoResponse {
    let collection = "backlog_items";
    
    let res: Result<BacklogItem, _> = state.db
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
            tracing::error!("Erro ao atualizar item de backlog: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_backlog_item(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "backlog_items";
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
            tracing::error!("Erro ao deletar item de backlog: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
