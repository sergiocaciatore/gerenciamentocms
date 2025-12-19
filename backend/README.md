# Backend - Cloud Run Ready

This FastAPI application has been containerized for Google Cloud Run.

## Prerequisites

- Python 3.12+ (for local dev)
- Docker
- Google Cloud SDK (`gcloud`)

## Local Development (Docker)

To run the container locally, simulating the Cloud Run environment:

1. **Build the image:**

    ```bash
    docker build -t cms-backend .
    ```

2. **Run the container:**

    You need to provide the `PORT` environment variable (Cloud Run defaults to 8080) and your Firebase Project ID.

    *Note: For local auth to work without a service account file, ensure you have run `gcloud auth application-default login` on your host machine, or mount your service account key.*

    ```bash
    # Basic run (will fail auth if no credentials provided)
    docker run -p 8080:8080 -e PORT=8080 -e FIREBASE_PROJECT_ID=your-project-id cms-backend
    ```

    **With Credentials (Recommended for testing):**
    If you have a `serviceAccountKey.json`, you can mount it:

    ```bash
    docker run -p 8080:8080 \
      -e PORT=8080 \
      -e FIREBASE_PROJECT_ID=your-project-id \
      -e GOOGLE_APPLICATION_CREDENTIALS=/tmp/keys/serviceAccountKey.json \
      -v $(pwd)/../serviceAccountKey.json:/tmp/keys/serviceAccountKey.json \
      cms-backend
    ```

## Deploy to Cloud Run

1. **Submit the build to Cloud Build:**

    ```bash
    gcloud builds submit --tag gcr.io/PROJECT_ID/cms-backend
    ```

    *Replace `PROJECT_ID` with your actual Google Cloud Project ID.*

2. **Deploy the service:**

    ```bash
    gcloud run deploy cms-backend \
      --image gcr.io/PROJECT_ID/cms-backend \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --port 8080
    ```

    *Note: `--allow-unauthenticated` makes the API public. Remove this flag if you want to restrict access to authenticated IAM users only (e.g. if using a Gateway).*

## Configuration

The application uses **Application Default Credentials (ADC)**.

- **On Cloud Run:** The service uses the attached Service Account (default or custom). ensure this account has permissions for:
  - Cloud Firestore User
  - Firebase Authentication Admin
  - Cloud Storage (if needed)
- **Locally:** Falls back to `GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth application-default login`.

**Environment Variables:**

- `PORT`: (Required) Port to listen on (injected by Cloud Run).
- `FIREBASE_PROJECT_ID`: (Optional but recommended) Explicit project ID.
- `CORS_ORIGINS`: (Optional) Comma-separated list of allowed origins.
