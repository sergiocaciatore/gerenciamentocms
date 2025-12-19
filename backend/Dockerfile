FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Expose port (Cloud Run uses environment variable PORT, typically 8080)
EXPOSE 8080

CMD ["sh","-c","gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:${PORT:-8080} --workers 2 --threads 4"]