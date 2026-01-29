use axum::{
    extract::{Query, Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use crate::AppState;
use crate::error::AppError;
use super::models::{Work, WorkCreate, ResidentAssignment};
use super::repository::WorksRepository;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", post(create_work).get(get_works))
        .route("/:id", axum::routing::delete(delete_work))
        .route("/:id/assignments", post(add_resident_assignment))
}

#[derive(Deserialize)]
pub struct ListParams {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub search: Option<String>,
    pub regional: Option<String>,
}

// Handler: Criar Obra
async fn create_work(
    State(state): State<AppState>,
    Json(payload): Json<WorkCreate>
) -> Result<Json<serde_json::Value>, AppError> {
    tracing::info!("Criando obra: {}", payload.id);
    
    WorksRepository::create(&state.db, payload.clone()).await?;
    
    Ok(Json(serde_json::json!({
        "message": "Work created successfully",
        "id": payload.id
    })))
}

// Handler: Listar Obras
async fn get_works(
    State(state): State<AppState>,
    Query(params): Query<ListParams>
) -> Result<Json<Vec<Work>>, AppError> {
    tracing::info!("Listando obras. Regional: {:?}", params.regional);
    
    let works = WorksRepository::list(
        &state.db, 
        params.limit.unwrap_or(20), 
        params.offset.unwrap_or(0),
        params.regional
    ).await?;
    
    Ok(Json(works))
}

// Handler: Deletar Obra
async fn delete_work(
    State(state): State<AppState>,
    Path(id): Path<String>
) -> Result<Json<serde_json::Value>, AppError> {
    tracing::info!("Deletando obra: {}", id);
    
    WorksRepository::delete(&state.db, &id).await?;
    
    Ok(Json(serde_json::json!({ "message": "Work deleted successfully" })))
}

// Handler: Adicionar Residente (Assignment)
async fn add_resident_assignment(
    State(state): State<AppState>,
    Path(work_id): Path<String>,
    Json(payload): Json<ResidentAssignment>
) -> Result<Json<serde_json::Value>, AppError> {
    tracing::info!("Adicionando residente à obra: {}", work_id);
    
    let collection = "works";
    
    // Ler obra para garantir existência e pegar residentes atuais
    let mut work = WorksRepository::get(&state.db, &work_id).await
        .map_err(|_| AppError::NotFound(format!("Obra não encontrada: {}", work_id)))?;
        
    let mut residents = work.residents.clone();
    residents.push(payload);
    
    // Atualizar no Firestore
    // Usamos fluent API direto pois WorksRepository::update não foi implementado ainda genericamente
    let _res: Work = state.db
        .fluent()
        .update()
        .in_col(collection)
        .document_id(&work_id)
        .object(&Work {
            residents,
            ..work
        })
        .execute()
        .await
        .map_err(|e| AppError::Anyhow(anyhow::anyhow!(e.to_string())))?;
        
    Ok(Json(serde_json::json!({ "message": "Resident assigned successfully" })))
}
