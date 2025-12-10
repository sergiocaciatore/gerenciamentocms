import os
import firebase_admin
from firebase_admin import credentials, auth
from dotenv import load_dotenv

load_dotenv()


_firebase_initialized = False


def initialize_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return

    try:
        # Check if app is already initialized (e.g. by another worker or test)
        firebase_admin.get_app()
        _firebase_initialized = True
        return
    except ValueError:
        pass

    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

    if service_account_path and os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)
        print(f"Firebase initialized with service account: {service_account_path}")
    else:
        # Fallback
        if service_account_path:
            print(
                f"Warning: FIREBASE_SERVICE_ACCOUNT_PATH was set to '{service_account_path}' but file does not exist."
            )
        else:
            print("Warning: FIREBASE_SERVICE_ACCOUNT_PATH not set.")

        # Try to get project_id from env to avoid "A project ID is required" error
        # This acts as a fallback for verifying tokens even without a service account file (if ADC is somehow working or just for structure)
        # But usually 'verify_id_token' needs the project ID to validate the issuer.
        project_id = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GCLOUD_PROJECT")

        # User frontend .env usually has VITE_FIREBASE_PROJECT_ID, maybe they set that in backend too?
        if not project_id:
            project_id = os.getenv("VITE_FIREBASE_PROJECT_ID")

        if project_id:
            print(f"Initializing with default credentials and projectId: {project_id}")
            firebase_admin.initialize_app(options={"projectId": project_id})
        else:
            print(
                "Initializing with default credentials (no projectId set). This may fail for auth verification."
            )
            firebase_admin.initialize_app()

    _firebase_initialized = True


# Call init
initialize_firebase()


def verify_token(token: str):
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        print(f"Error verifying token: {e}")
        return None
