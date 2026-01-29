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
pub struct TeamMember {
    pub id: String,
    pub name: String,
    pub role: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_team).post(create_team_member))
        .route("/:id", get(get_team_member).put(update_team_member).delete(delete_team_member))
}

async fn list_team(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let collection = "team";
    let stream_result = state.db
        .fluent()
        .list()
        .from(collection)
        .obj::<TeamMember>()
        .stream_all()
        .await;

    match stream_result {
        Ok(stream) => {
            let members: Vec<TeamMember> = stream.collect().await;
            Json::<Vec<TeamMember>>(members).into_response()
        },
        Err(e) => {
            tracing::error!("Erro ao listar equipe: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao buscar equipe").into_response()
        }
    }
}

async fn create_team_member(
    State(state): State<AppState>,
    Json(payload): Json<TeamMember>,
) -> impl IntoResponse {
    let collection = "team";
    
    let res: Result<TeamMember, _> = state.db
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
            tracing::error!("Erro ao criar membro da equipe: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao criar membro").into_response()
        }
    }
}

async fn get_team_member(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "team";
    let res: firestore::FirestoreResult<Option<TeamMember>> = state.db
        .fluent()
        .select()
        .by_id_in(collection)
        .obj::<TeamMember>()
        .one(&id)
        .await;

    match res {
        Ok(Some(member)) => Json::<TeamMember>(member).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Membro não encontrado").into_response(),
        Err(e) => {
            tracing::error!("Erro ao buscar membro: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro interno").into_response()
        }
    }
}

async fn update_team_member(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<TeamMember>,
) -> impl IntoResponse {
    let collection = "team";
    
    let res: Result<TeamMember, _> = state.db
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
            tracing::error!("Erro ao atualizar membro: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao atualizar").into_response()
        }
    }
}

async fn delete_team_member(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let collection = "team";
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
            tracing::error!("Erro ao deletar membro: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Erro ao deletar").into_response()
        }
    }
}
