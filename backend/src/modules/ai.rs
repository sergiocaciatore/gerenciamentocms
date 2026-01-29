// Módulo de IA - Integração OpenAI via reqwest
// Implementa: /ai/chat, /ai/upload, /ai/download/:file_id, /ai/enhance

use axum::{
    routing::{get, post},
    Router,
    response::IntoResponse,
    Json,
    extract::Path,
    http::StatusCode,
};
use axum_extra::extract::Multipart;
use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;
use std::fs;
use uuid::Uuid;
use crate::AppState;

// Diretório temporário para arquivos
fn get_temp_dir() -> PathBuf {
    let dir = PathBuf::from("/tmp/cms_uploads");
    if !dir.exists() {
        fs::create_dir_all(&dir).ok();
    }
    dir
}

// --- Structs ---

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub message: String,
    #[serde(default)]
    pub history: Vec<ChatMessage>,
    #[serde(default)]
    pub config: ChatConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ChatConfig {
    #[serde(default)]
    pub introduction: String,
    #[serde(default = "default_tone")]
    pub tone: String,
}

fn default_tone() -> String {
    "Estrategista".to_string()
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub response: String,
    #[serde(default)]
    pub files: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct EnhanceRequest {
    pub text: String,
    #[serde(default)]
    pub context: String,
}

#[derive(Debug, Serialize)]
pub struct EnhanceResponse {
    pub formatted_text: String,
}

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub file_id: String,
    pub filename: String,
    pub stored_name: String,
}

// --- OpenAI Request/Response ---

#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

// --- Router ---

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/chat", post(chat_endpoint))
        .route("/upload", post(upload_file))
        .route("/download/:file_id", get(download_file))
        .route("/enhance", post(enhance_endpoint))
}

// --- Prompt Base ---

const BASE_SYSTEM_PROMPT: &str = r#"
Você é um AI Assistant especialista em Gerenciamento de Engenharia para um Sistema de Gestão de Obras (CMS).
Seu objetivo é ajudar gerentes de projeto e engenheiros respondendo perguntas sobre obras em andamento, fornecendo conselhos estratégicos e auxiliando no planejamento.

VOCABULÁRIO IMPORTANTE:
- "Golive": Data em que a obra deve ser entregue e entrar em operação.

Ao responder:
1. Seja profissional, conciso e prestativo.
2. Se faltarem dados (por exemplo, data nula), mencione isso claramente.
3. Se estiver criando um relatório ou estratégia, use os dados disponíveis para justificar suas recomendações.
4. Fale sempre em Português (Brasil).
"#;

fn get_tone_instruction(tone: &str) -> &'static str {
    match tone {
        "Técnico" => "Adote uma postura TÉCNICA. Foque em valores, contas, cálculos, datas precisas e detalhes de execução. Seja direto e analítico.",
        "Estrategista" => "Adote uma postura ESTRATEGISTA. Identifique possíveis erros, preveja problemas futuros, analise riscos e sugira caminhos de longo prazo. Seja crítico e visionário.",
        "Ideias" => "Adote uma postura CRIATIVA (Ideias). O usuário pode estar perdido. Ofereça brainstorming, soluções inovadoras e alternativas fora da caixa para destravar problemas.",
        "Gestor" => "Adote uma postura de GESTOR. Foque em prazos, stakeholders, milestones, organização de equipe e visão macro do progresso. Ajude a organizar a casa.",
        _ => "Adote uma postura ESTRATEGISTA. Identifique possíveis erros, preveja problemas futuros, analise riscos e sugira caminhos de longo prazo. Seja crítico e visionário.",
    }
}

// Função auxiliar para chamar OpenAI
async fn call_openai(messages: Vec<OpenAIMessage>) -> Result<String, String> {
    let api_key = env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY não configurada".to_string())?;

    let client = reqwest::Client::new();
    
    let request_body = OpenAIRequest {
        model: "gpt-4o-mini".to_string(),
        messages,
    };

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI error {}: {}", status, text));
    }

    let openai_response: OpenAIResponse = response
        .json()
        .await
        .map_err(|e| format!("Erro ao parsear resposta: {}", e))?;

    openai_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .ok_or_else(|| "Sem resposta da IA".to_string())
}

// --- Handlers ---

// Handler: Chat com IA
async fn chat_endpoint(
    Json(request): Json<ChatRequest>,
) -> impl IntoResponse {
    // Construir system prompt
    let mut system_content = BASE_SYSTEM_PROMPT.to_string();
    
    if !request.config.introduction.is_empty() {
        system_content.push_str(&format!(
            "\n\nCONTEXTO DO USUÁRIO:\nO usuário se descreve assim: '{}'. Leve isso em consideração.",
            request.config.introduction
        ));
    }

    let tone_instruction = get_tone_instruction(&request.config.tone);
    system_content.push_str(&format!("\n\nTOM DE VOZ:\n{}", tone_instruction));

    let messages = vec![
        OpenAIMessage {
            role: "system".to_string(),
            content: system_content,
        },
        OpenAIMessage {
            role: "user".to_string(),
            content: request.message,
        },
    ];

    match call_openai(messages).await {
        Ok(content) => {
            Json(ChatResponse {
                response: content,
                files: vec![],
            }).into_response()
        }
        Err(e) => {
            tracing::error!("Erro OpenAI: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": e,
                "response": "Desculpe, ocorreu um erro ao processar sua solicitação."
            }))).into_response()
        }
    }
}

// Handler: Enhance texto com IA
async fn enhance_endpoint(
    Json(request): Json<EnhanceRequest>,
) -> impl IntoResponse {
    let system_prompt = r#"
    Você é um Editor Técnico Sênior de Engenharia.
    Sua função é revisar, corrigir e formatar textos de relatórios de obras.
    
    DIRETRIZES:
    1. CORREÇÃO: Corrija ortografia e gramática.
    2. TOM TÉCNICO: Mantenha siglas como "PP", "CT", "PO", "SLA" etc. NÃO INVENTE significados.
    3. FORMATAÇÃO HTML:
       - Use <b>...</b> para destacar pontos chave, valores e prazos críticos.
       - Use <span style="color: #dc2626">...</span> (vermelho) para riscos, atrasos ou bloqueios.
       - Use <span style="color: #16a34a">...</span> (verde) para conclusões, sucessos ou liberações.
       - Use <br/> para quebras de linha se necessário.
    4. ESTRUTURA: Se o texto for longo, organize em tópicos (<ul><li>...</li></ul>).
    5. RESUMO: Se o texto for confuso, reescreva de forma mais clara mas sem perder informação.
    
    Retorne APENAS o HTML do texto melhorado, sem conversa fiada.
    "#;

    let user_content = format!("Texto Original: {}\nContexto: {}", request.text, request.context);

    let messages = vec![
        OpenAIMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        OpenAIMessage {
            role: "user".to_string(),
            content: user_content,
        },
    ];

    match call_openai(messages).await {
        Ok(content) => {
            Json(EnhanceResponse {
                formatted_text: content,
            }).into_response()
        }
        Err(e) => {
            tracing::error!("Erro ao melhorar texto: {}", e);
            // Fallback: retornar texto original
            Json(EnhanceResponse {
                formatted_text: request.text,
            }).into_response()
        }
    }
}

// Handler: Upload de arquivo
async fn upload_file(
    mut multipart: Multipart,
) -> impl IntoResponse {
    loop {
        match multipart.next_field().await {
            Ok(Some(field)) => {
                let filename: String = field.file_name()
                    .map(|s: &str| s.to_string())
                    .unwrap_or_else(|| "unknown".to_string());
                
                let file_id = Uuid::new_v4().to_string();
                let extension = std::path::Path::new(&filename)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("");
                
                let stored_name = if extension.is_empty() {
                    file_id.clone()
                } else {
                    format!("{}.{}", file_id, extension)
                };
                
                let file_path = get_temp_dir().join(&stored_name);
                
                match field.bytes().await {
                    Ok(data) => {
                        if let Err(e) = fs::write(&file_path, &data) {
                            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                                "error": format!("Erro ao salvar arquivo: {}", e)
                            }))).into_response();
                        }
                        
                        return Json(UploadResponse {
                            file_id,
                            filename,
                            stored_name,
                        }).into_response();
                    }
                    Err(e) => {
                        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                            "error": format!("Erro ao ler arquivo: {}", e)
                        }))).into_response();
                    }
                }
            }
            Ok(None) => break,
            Err(e) => {
                return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                    "error": format!("Erro ao processar upload: {}", e)
                }))).into_response();
            }
        }
    }
    
    (StatusCode::BAD_REQUEST, Json(serde_json::json!({
        "error": "Nenhum arquivo enviado"
    }))).into_response()
}

// Handler: Download de arquivo
async fn download_file(
    Path(file_id): Path<String>,
) -> impl IntoResponse {
    // Segurança: evitar path traversal
    if file_id.contains('/') || file_id.contains('\\') || file_id.contains("..") {
        return (StatusCode::BAD_REQUEST, "Invalid file ID").into_response();
    }

    let temp_dir = get_temp_dir();
    
    // Buscar arquivo que começa com o file_id
    let entries = match fs::read_dir(&temp_dir) {
        Ok(e) => e,
        Err(_) => return (StatusCode::NOT_FOUND, "File not found").into_response(),
    };

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        
        if name_str.starts_with(&file_id) {
            match fs::read(entry.path()) {
                Ok(data) => {
                    // Deletar arquivo após leitura
                    let _ = fs::remove_file(entry.path());
                    
                    return (
                        StatusCode::OK,
                        [
                            ("Content-Type", "application/octet-stream"),
                            ("Content-Disposition", &format!("attachment; filename=\"{}\"", name_str)),
                        ],
                        data
                    ).into_response();
                }
                Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Error reading file").into_response(),
            }
        }
    }

    (StatusCode::NOT_FOUND, "File not found or expired").into_response()
}
