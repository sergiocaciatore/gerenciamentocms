use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts, StatusCode},
    response::IntoResponse,
    Json, Router, routing::get,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use base64::{engine::general_purpose, Engine as _};
use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new().route("/me", get(get_me))
}

#[derive(Debug, Serialize, Deserialize)]
struct UserClaims {
    user_id: String,
    email: Option<String>,
    name: Option<String>,
    picture: Option<String>,
    sub: String,
}

async fn get_me(headers: axum::http::HeaderMap) -> impl IntoResponse {
    let auth_header = headers.get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    match auth_header {
        Some(header) if header.starts_with("Bearer ") => {
            let token = &header[7..];
            match decode_jwt_payload_unverified(token) {
                Ok(claims) => {
                    // Mapeia para o formato que o frontend espera
                    // Python: uid, email, name, picture, tenant_id="mel", roles=["user"]
                    let response = json!({
                        "uid": claims.sub, // Firebase uid fica em 'sub' ou 'user_id'
                        "email": claims.email,
                        "name": claims.name,
                        "picture": claims.picture,
                        "tenant_id": "mel",
                        "roles": ["user"]
                    });
                    Json(response).into_response()
                },
                Err(e) => {
                    tracing::error!("Erro ao decodificar token: {}", e);
                    (StatusCode::UNAUTHORIZED, "Token inválido").into_response()
                }
            }
        },
        _ => {
            // Em dev, se não tiver token, podemos retornar erro ou um mock se você preferir.
            // Para manter consistência com production, retornamos 401.
            (StatusCode::UNAUTHORIZED, "Token não fornecido").into_response()
        }
    }
}

// Decodifica apenas o payload (parte do meio) do JWT sem verificar assinatura
fn decode_jwt_payload_unverified(token: &str) -> Result<UserClaims, String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Token JWT malformado".to_string());
    }

    let payload_b64 = parts[1];
    
    // JWT usa Base64URL (sem padding), precisamos tratar isso
    let decoded = general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(payload_b64)) // Tenta standard se url safe falhar
        .map_err(|e| format!("Erro base64: {}", e))?;

    let claims: UserClaims = serde_json::from_slice(&decoded)
        .map_err(|e| format!("Erro JSON: {}", e))?;

    Ok(claims)
}
