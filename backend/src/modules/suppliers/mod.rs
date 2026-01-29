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
pub struct Supplier {
    pub id: String, // ID é definido pelo usuário no frontend (CNPJ ou similar)
    pub social_reason: String,
    pub cnpj: String,
    pub contract_start: String,
    pub contract_end: String,
    pub project: String,
    pub hiring_type: String,
    pub headquarters: String,
    pub legal_representative: String,
    pub representative_email: String,
    pub contact: String,
    pub witness: String,
    pub witness_email: String,
    pub observations: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_suppliers).post(create_supplier))
        .route("/:id", get(get_supplier).put(update_supplier).delete(delete_supplier))
}

async fn list_suppliers(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "suppliers";
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<Supplier>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let suppliers: Vec<Supplier> = stream.collect().await;
            Json::<Vec<Supplier>>(suppliers).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar fornecedores: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar fornecedores").into_response()
        }
    }
}

async fn create_supplier(
    State(state): State<AppState>,
    Json(payload): Json<Supplier>,
) -> impl IntoResponse {
    let collection = "suppliers";
    
    // Python usa .document(supplier.id).set(...)
    let res: Result<Supplier, _> = state.db
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
            tracing::error!("Erro ao criar fornecedor: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao criar fornecedor").into_response()
        }
    }
}

async fn get_supplier(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "suppliers";
    let res: firestore::FirestoreResult<Option<Supplier>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<Supplier>()
        .one(&id)
        .await;

    match res {
        Ok(Some(s)) => Json::<Supplier>(s).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Fornecedor não encontrado").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar fornecedor: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_supplier(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<Supplier>,
) -> impl IntoResponse {
    let collection = "suppliers";
    
    let res: Result<Supplier, _> = state.db
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
            tracing::error!("Erro ao atualizar fornecedor: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_supplier(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "suppliers";
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
            tracing::error!("Erro ao deletar fornecedor: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
