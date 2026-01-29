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

pub mod models;
use models::Management;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_managements).post(create_management))
        .route("/:work_id", get(get_management).put(update_management).delete(delete_management))
}

async fn list_managements(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "managements";
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<Management>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let mut managements: Vec<Management> = stream.collect().await;
            
            // Garantir que work_id esteja presente (backfill se necessário)
            // No Rust, como struct é tipado, work_id é obrigatório.
            // Se o documento no Firestore não tiver work_id, o deserialize falharia?
            // Ou retornaria struct default? Vamos assumir que os dados estão ok ou usar Serde defaults.
            // O struct Management tem work_id como String, so it's required.
            
            Json::<Vec<Management>>(managements).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar managements: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar dados de gestão").into_response()
        }
    }
}

async fn create_management(
    State(state): State<AppState>,
    Json(payload): Json<Management>,
) -> impl IntoResponse {
    let collection = "managements";
    let doc_id = payload.work_id.clone();
    
    // Usar work_id como ID (doc_ref.set no Python)
    let res: Result<Management, _> = state.db
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
            tracing::error!("Erro ao criar management: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao criar dados de gestão").into_response()
        }
    }
}

async fn get_management(
    State(state): State<AppState>,
    Path(work_id): Path<String>,
) -> impl IntoResponse {
    let collection = "managements";
    let res: firestore::FirestoreResult<Option<Management>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<Management>()
        .one(&work_id)
        .await;

    match res {
        Ok(Some(mgmt)) => Json::<Management>(mgmt).into_response(),
        Ok(None) => Json(serde_json::json!({})).into_response(), // Retorna vazio como no Python
        Err(e) => {
            tracing::error!("Erro ao buscar management: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_management(
    State(state): State<AppState>,
    Path(work_id): Path<String>,
    Json(payload): Json<Management>,
) -> impl IntoResponse {
    let collection = "managements";
    
    let res: Result<Management, _> = state.db
        .fluent()
        .update()
        .in_col(collection)
        .document_id(&work_id)
        .object(&payload)
        .execute()
        .await;

    match res {
        Ok(_) => (StatusCode::OK, Json(payload)).into_response(),
        Err(e) => {
            tracing::error!("Erro ao atualizar management: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_management(
    State(state): State<AppState>,
    Path(work_id): Path<String>,
) -> impl IntoResponse {
    let collection = "managements";
    let res = state.db
        .fluent()
        .delete()
        .from(collection)
        .document_id(&work_id)
        .execute()
        .await;

    match res {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => {
            tracing::error!("Erro ao deletar management: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
