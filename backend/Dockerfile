FROM python:3.12-slim
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .
COPY serviceAccountKey.json .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY app ./app

ENV FIREBASE_SERVICE_ACCOUNT_PATH=/app/serviceAccountKey.json
# Expose port (Cloud Run uses environment variable PORT, typically 8080)
EXPOSE 8080

CMD ["sh","-c","gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:${PORT:-8080} --workers 2 --threads 4"]