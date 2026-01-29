// Módulo de Email - SMTP
// Implementa: /verify-email, /send-custom-email

use axum::{
    routing::post,
    Router,
    response::IntoResponse,
    Json,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use lettre::{
    transport::smtp::authentication::Credentials,
    Message, SmtpTransport, Transport,
    message::{header::ContentType, Mailbox},
};
use crate::AppState;

// Configuração do servidor de email
const SMTP_SERVER: &str = "postmail.cmseng.com.br";
const SMTP_PORT: u16 = 465;

// --- Structs ---

#[derive(Debug, Deserialize)]
pub struct EmailConfig {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct EmailRecipient {
    pub email: String,
    #[serde(default)]
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct CustomEmailRequest {
    pub recipient_email: Option<String>,
    #[serde(default)]
    pub recipients: Vec<EmailRecipient>,
    pub subject: String,
    pub body: String,
    pub sender_email: Option<String>,
    pub sender_password: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VerifyResponse {
    pub message: String,
    pub valid: bool,
}

#[derive(Debug, Serialize)]
pub struct SendResponse {
    pub message: String,
}

// --- Router ---

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/verify-email", post(verify_email))
        .route("/send-custom-email", post(send_custom_email))
}

// --- Handlers ---

// Handler: Verificar credenciais de email
async fn verify_email(
    Json(config): Json<EmailConfig>,
) -> impl IntoResponse {
    let email = config.email.clone();
    let password = config.password.clone();

    // Tentar conectar via SMTP para verificar credenciais
    let creds = Credentials::new(email.clone(), password);

    // Criar transporte SMTP com TLS
    let mailer = match SmtpTransport::relay(SMTP_SERVER) {
        Ok(transport) => transport
            .port(SMTP_PORT)
            .credentials(creds)
            .build(),
        Err(e) => {
            tracing::error!("Erro ao configurar SMTP: {}", e);
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "message": format!("Falha na configuração SMTP: {}", e),
                "valid": false
            }))).into_response();
        }
    };

    // Testar conexão
    match mailer.test_connection() {
        Ok(true) => {
            Json(VerifyResponse {
                message: "Credenciais verificadas com sucesso!".to_string(),
                valid: true,
            }).into_response()
        }
        Ok(false) => {
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "message": "Falha na autenticação SMTP",
                "valid": false
            }))).into_response()
        }
        Err(e) => {
            tracing::error!("Erro ao verificar email: {}", e);
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "message": format!("Falha na autenticação: {}", e),
                "valid": false
            }))).into_response()
        }
    }
}

// Handler: Enviar email personalizado
async fn send_custom_email(
    Json(request): Json<CustomEmailRequest>,
) -> impl IntoResponse {
    // Obter credenciais (fornecidas ou padrão via env)
    let sender_email = request.sender_email
        .or_else(|| std::env::var("DEFAULT_SMTP_EMAIL").ok())
        .unwrap_or_default();
    
    let sender_password = request.sender_password
        .or_else(|| std::env::var("DEFAULT_SMTP_PASSWORD").ok())
        .unwrap_or_default();

    if sender_email.is_empty() || sender_password.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "Credenciais de email não fornecidas"
        }))).into_response();
    }

    // Coletar destinatários
    let mut recipients: Vec<String> = vec![];
    
    if let Some(ref email) = request.recipient_email {
        recipients.push(email.clone());
    }
    
    for r in &request.recipients {
        if !r.email.is_empty() {
            recipients.push(r.email.clone());
        }
    }

    if recipients.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "Nenhum destinatário fornecido"
        }))).into_response();
    }

    // Enviar para cada destinatário
    let creds = Credentials::new(sender_email.clone(), sender_password);

    let mailer = match SmtpTransport::relay(SMTP_SERVER) {
        Ok(transport) => transport
            .port(SMTP_PORT)
            .credentials(creds)
            .build(),
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Erro ao configurar SMTP: {}", e)
            }))).into_response();
        }
    };

    for recipient in recipients {
        let from_mailbox: Mailbox = match sender_email.parse() {
            Ok(m) => m,
            Err(e) => {
                tracing::error!("Email remetente inválido: {}", e);
                continue;
            }
        };

        let to_mailbox: Mailbox = match recipient.parse() {
            Ok(m) => m,
            Err(e) => {
                tracing::error!("Email destinatário inválido: {}", e);
                continue;
            }
        };

        let email = match Message::builder()
            .from(from_mailbox)
            .to(to_mailbox)
            .subject(&request.subject)
            .header(ContentType::TEXT_HTML)
            .body(request.body.clone())
        {
            Ok(e) => e,
            Err(e) => {
                tracing::error!("Erro ao construir email: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                    "error": format!("Erro ao construir email: {}", e)
                }))).into_response();
            }
        };

        if let Err(e) = mailer.send(&email) {
            tracing::error!("Erro ao enviar email para {}: {}", recipient, e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Erro ao enviar email: {}", e)
            }))).into_response();
        }
    }

    Json(SendResponse {
        message: "Email enviado com sucesso!".to_string(),
    }).into_response()
}
