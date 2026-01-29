FROM rust:1.84

WORKDIR /app

# Instalar dependências de sistema (OpenSSL é comum)
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Configurar diretório para cache do Cargo
ENV CARGO_TARGET_DIR=/app/target_docker

COPY . .

# Compilar durante o build (aproveita melhor a rede do build kit)
RUN cargo build

# Expor a porta 8000
EXPOSE 8000

# Executar o binário compilado
CMD ["/app/target_docker/debug/cms-backend"]
