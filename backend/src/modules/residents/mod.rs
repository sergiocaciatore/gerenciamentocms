use serde::{Deserialize, Serialize};
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
pub struct Metrics {
    pub technical: f64,
    pub management: f64,
    pub leadership: f64,
    pub organization: f64,
    pub commitment: f64,
    pub communication: f64,
    pub count: i32,
}

impl Default for Metrics {
    fn default() -> Self {
        Self {
            technical: 0.0,
            management: 0.0,
            leadership: 0.0,
            organization: 0.0,
            commitment: 0.0,
            communication: 0.0,
            count: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resident {
    pub id: Option<String>,
    pub name: String,
    pub email: String,
    pub crea: String,
    #[serde(default)]
    pub metrics: Metrics,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_residents).post(create_resident))
        .route("/:id", get(get_resident).put(update_resident).delete(delete_resident))
}

async fn list_residents(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "residents";
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<Resident>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let mut items: Vec<Resident> = stream.collect().await;
            // Garantir que IDs estão preenchidos se o firestore retornar sem campo id no documento
            // (geralmente firestore-rs preenche se struct tiver campo id e decorado corretamente,
            // mas aqui estamos usando document_id separado no insert. Na leitura, se o campo id estiver no json, ok.)
            Json(items).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar residentes: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar residentes").into_response()
        }
    }
}

async fn create_resident(
    State(state): State<AppState>,
    Json(mut payload): Json<Resident>,
) -> impl IntoResponse {
    let collection = "residents";
    
    let id = if let Some(ref id) = payload.id {
        id.clone()
    } else {
        Uuid::new_v4().to_string()
    };
    payload.id = Some(id.clone());

    let res: Result<Resident, _> = state.db
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
            tracing::error!("Erro ao criar residente: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao criar residente").into_response()
        }
    }
}

async fn get_resident(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "residents";
    let res: firestore::FirestoreResult<Option<Resident>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<Resident>()
        .one(&id)
        .await;

    match res {
        Ok(Some(res)) => Json(res).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Residente não encontrado").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar residente: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_resident(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<Resident>,
) -> impl IntoResponse {
    let collection = "residents";
    
    // Check ID match? payload.id might be None or differ.
    // Legacy checks: if resident_id != resident.id: raise 400
    if let Some(ref pid) = payload.id {
        if pid != &id {
            return (StatusCode::BAD_REQUEST, "ID mismatch").into_response();
        }
    }
    
    let res: Result<Resident, _> = state.db
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
            tracing::error!("Erro ao atualizar residente: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_resident(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "residents";
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
            tracing::error!("Erro ao deletar residente: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
