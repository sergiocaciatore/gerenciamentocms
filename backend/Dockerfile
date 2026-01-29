# =============================================================================
# Dockerfile para Backend Rust - Otimizado para Cloud Run
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM rust:latest AS builder

WORKDIR /app

# Instalar dependências de sistema necessárias para compilação
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar arquivos do projeto
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/

# Compilar em modo release (otimizado para produção)
RUN cargo build --release

# -----------------------------------------------------------------------------
# Stage 2: Runtime (imagem mínima)
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim

WORKDIR /app

# Instalar apenas as dependências de runtime necessárias
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Criar usuário não-root para segurança
RUN useradd -r -s /bin/false appuser

# Copiar binário compilado do stage de build
COPY --from=builder /app/target/release/cms-backend /app/cms-backend

# Copiar arquivo de credenciais do Google Cloud (se existir)
COPY serviceAccountKey.json /app/serviceAccountKey.json

# Definir variável de ambiente para credenciais do Google Cloud
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/serviceAccountKey.json

# Alterar propriedade dos arquivos para o usuário não-root
RUN chown -R appuser:appuser /app

# Usar usuário não-root
USER appuser

# Cloud Run define PORT=8080 automaticamente
EXPOSE 8080

# Executar o binário
CMD ["/app/cms-backend"]
