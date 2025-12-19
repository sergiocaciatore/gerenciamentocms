FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app

# Expose port (Cloud Run uses environment variable PORT, typically 8080)
EXPOSE 8080

# Run with Gunicorn using Uvicorn workers
# Binding to 0.0.0.0:$PORT
CMD ["sh","-c","gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:${PORT:-8080} --workers 2 --threads 4"]