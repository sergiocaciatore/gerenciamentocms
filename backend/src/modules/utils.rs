use axum::{
    response::IntoResponse,
    Json,
    extract::Path,
    http::StatusCode,
};
use reqwest::Client;

// Handler: Consulta CEP (ViaCEP)
pub async fn get_cep(Path(cep): Path<String>) -> impl IntoResponse {
    let client = Client::new();
    let url = format!("https://viacep.com.br/ws/{}/json/", cep);
    
    match client.get(&url).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<serde_json::Value>().await {
                    Ok(json) => Json(json).into_response(),
                    Err(_) => (StatusCode::BAD_REQUEST, "Invalid JSON from ViaCEP").into_response(),
                }
            } else {
                (StatusCode::BAD_REQUEST, "CEP not found").into_response()
            }
        },
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Error fetching CEP").into_response()
    }
}
