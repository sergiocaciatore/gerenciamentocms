use axum::{
    routing::get,
    Router,
};
use firestore::FirestoreDb;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod error;
mod modules;

// Estado global compartilhado
#[derive(Clone)]
pub struct AppState {
    pub db: FirestoreDb,
}

#[tokio::main]
async fn main() {
    // 1. Configurar Logger
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "cms_backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Iniciando CMS Backend em Rust...");

    // 2. Carregar Config
    let config = config::Config::from_env();

    // 3. Inicializar Firestore
    tracing::info!("Conectando ao Firestore (Project: {})...", config.firestore_project_id);
    let db = FirestoreDb::new(&config.firestore_project_id)
        .await
        .expect("Falha ao inicializar Firestore");

    let state = AppState { db };

    // 4. Configurar Rotas
    let app = Router::new()
        .route("/", get(root_handler))
        .route("/health", get(health_handler))
        .merge(modules::routes())
        .with_state(state) // Injeta o estado
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    // 5. Iniciar Servidor
    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    tracing::info!("Servidor ouvindo em {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn root_handler() -> &'static str {
    "CMS Backend (Rust) is running 🚀"
}

async fn health_check() -> serde_json::Value {
    serde_json::json!({ "status": "ok", "timestamp": chrono::Utc::now() })
}

async fn health_handler() -> axum::Json<serde_json::Value> {
    axum::Json(health_check().await)
}
