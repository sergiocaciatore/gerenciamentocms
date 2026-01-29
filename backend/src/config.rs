use dotenvy::dotenv;
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub firestore_project_id: String,
    pub database_url: Option<String>, // Para compatibilidade futura ou uso interno
}

impl Config {
    pub fn from_env() -> Self {
        dotenv().ok(); // Carrega .env se existir

        tracing::info!("Carregando configurações...");

        let project_id = env::var("GCP_PROJECT_ID")
            .or_else(|_| env::var("GOOGLE_CLOUD_PROJECT"))
            .unwrap_or_else(|_| "mel".to_string()); // Fallback seguro ou erro

        Self {
            firestore_project_id: project_id,
            database_url: env::var("DATABASE_URL").ok(),
        }
    }
}
