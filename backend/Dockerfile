FROM python:3.12-slim
WORKDIR /app

# Copia o arquivo de dependências para o container
COPY requirements.txt .
COPY serviceAccountKey.json .

# Instala os pacotes necessários especificados no requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copia o conteúdo do diretório atual para o container em /app
COPY app ./app

ENV FIREBASE_SERVICE_ACCOUNT_PATH=/app/serviceAccountKey.json
# Expõe a porta (O Cloud Run utiliza a variável de ambiente PORT, geralmente 8080)
EXPOSE 8080

CMD ["sh","-c","gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:${PORT:-8080} --workers 2 --threads 4"]