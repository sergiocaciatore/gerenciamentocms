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
        .route("/:id", axum::routing::delete(delete_work).put(update_work))
        .route("/:id/assignments", post(add_resident_assignment))
        .route("/:id/assignments/:resident_id", axum::routing::delete(remove_resident_from_work))
        .route("/:id/assignments/:resident_id/evaluate", post(evaluate_resident))
}

#[derive(Deserialize)]
pub struct ListParams {
// ...
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

// Handler: Atualizar Obra
async fn update_work(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<WorkCreate>
) -> Result<Json<serde_json::Value>, AppError> {
    tracing::info!("Atualizando obra: {}", id);
    
    // Verificar se IDs batem? Opcional mas bom.
    if payload.id != id {
        return Err(AppError::BadRequest("ID mismatch".to_string()));
    }
    
    WorksRepository::update(&state.db, &id, payload).await?;
    
    Ok(Json(serde_json::json!({ "message": "Work updated successfully" })))
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
    
    // Atualizar no Firestore via update
    let work_update = WorkCreate {
        id: work.id.clone(),
        regional: work.regional.clone(),
        go_live_date: work.go_live_date.clone(),
        cep: work.cep.clone(),
        address: work.address.clone(),
        work_type: work.work_type.clone(),
        cnpj: work.cnpj.clone(),
        business_case: work.business_case.clone(),
        capex_approved: work.capex_approved.clone(),
        internal_order: work.internal_order.clone(),
        oi: work.oi.clone(),
        residents,
    };

    let _ = WorksRepository::update(&state.db, &work_id, work_update).await?;
        
    Ok(Json(serde_json::json!({ "message": "Resident assigned successfully" })))
}

// Handler: Avaliar Residente
async fn evaluate_resident(
    State(state): State<AppState>,
    Path((work_id, resident_id)): Path<(String, String)>,
    Json(evaluation): Json<super::models::Evaluation>
) -> Result<Json<serde_json::Value>, AppError> {
    tracing::info!("Avaliando residente {} na obra {}", resident_id, work_id);
    
    // 1. Atualizar Obra
    let mut work = WorksRepository::get(&state.db, &work_id).await?;
    let mut found = false;
    
    for r in &mut work.residents {
        if r.id == resident_id {
            r.evaluation = Some(evaluation.clone());
            found = true;
            break;
        }
    }
    
    if !found {
        return Err(AppError::NotFound("Resident not assigned to this work".to_string()));
    }
    
    // Salvar obra atualizada
    // TODO: WorkCreate conversion? 
    // Como Work e WorkCreate são quase idênticos, podemos usar WorkCreate no update. 
    // Mas Work -> WorkCreate requer conversão manual ou From trait. 
    // Vou fazer conversão manual rápida aqui pra não criar trait agora.
    let work_update = WorkCreate {
        id: work.id.clone(),
        regional: work.regional.clone(),
        go_live_date: work.go_live_date.clone(),
        cep: work.cep.clone(),
        address: work.address.clone(),
        work_type: work.work_type.clone(),
        cnpj: work.cnpj.clone(),
        business_case: work.business_case.clone(),
        capex_approved: work.capex_approved.clone(),
        internal_order: work.internal_order.clone(),
        oi: work.oi.clone(),
        residents: work.residents.clone(),
    };
    
    WorksRepository::update(&state.db, &work_id, work_update).await?;
    
    // 2. Atualizar Métricas Agregadas do Residente (residents collection)
    use crate::modules::residents::Resident;
    let res_coll = "residents";
    let resident_opt: Option<Resident> = state.db.fluent()
        .select().by_id_in(res_coll).obj().one(&resident_id).await
        .unwrap_or(None);
        
    if let Some(mut resident) = resident_opt {
        let current = resident.metrics;
        let count = current.count as f64;
        let new_count = count + 1.0;
        
        // Recalcular médias
        // Lógica do python: (old_avg * old_count + new_val) / new_count
        let new_metrics = crate::modules::residents::Metrics {
            technical: (current.technical * count + evaluation.technical as f64) / new_count,
            management: (current.management * count + evaluation.management as f64) / new_count,
            leadership: (current.leadership * count + evaluation.leadership as f64) / new_count,
            organization: (current.organization * count + evaluation.organization as f64) / new_count,
            commitment: (current.commitment * count + evaluation.commitment as f64) / new_count,
            communication: (current.communication * count + evaluation.communication as f64) / new_count,
            count: new_count as i32,
        };
        
        resident.metrics = new_metrics;
        
        let _ = state.db.fluent()
            .update()
            .in_col(res_coll)
            .document_id(&resident_id)
            .object(&resident)
            .execute::<()>()
            .await;
    }

    Ok(Json(serde_json::json!({ "message": "Evaluation saved successfully" })))
}

// Handler: Remover Residente da Obra
async fn remove_resident_from_work(
    State(state): State<AppState>,
    Path((work_id, resident_id)): Path<(String, String)>
) -> Result<Json<serde_json::Value>, AppError> {
    tracing::info!("Removendo residente {} da obra {}", resident_id, work_id);
    
    let mut work = WorksRepository::get(&state.db, &work_id).await?;
    let initial_len = work.residents.len();
    
    work.residents.retain(|r| r.id != resident_id);
    
    if work.residents.len() == initial_len {
         return Err(AppError::NotFound("Resident not found in this work".to_string()));
    }
    
    // Salvar
    let work_update = WorkCreate {
        id: work.id.clone(),
        regional: work.regional.clone(),
        go_live_date: work.go_live_date.clone(),
        cep: work.cep.clone(),
        address: work.address.clone(),
        work_type: work.work_type.clone(),
        cnpj: work.cnpj.clone(),
        business_case: work.business_case.clone(),
        capex_approved: work.capex_approved.clone(),
        internal_order: work.internal_order.clone(),
        oi: work.oi.clone(),
        residents: work.residents.clone(),
    };
    
    WorksRepository::update(&state.db, &work_id, work_update).await?;
    
    Ok(Json(serde_json::json!({ "message": "Resident removed from work successfully" })))
}
