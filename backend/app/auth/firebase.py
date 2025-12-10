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
        # Fallback for when no specific path is provided (e.g. Cloud Run with default credentials)
        # Or if the path provided doesn't exist.
        print(
            "Warning: FIREBASE_SERVICE_ACCOUNT_PATH not set or file not found. Initializing with default credentials."
        )
        firebase_admin.initialize_app()

    _firebase_initialized = True


initialize_firebase()


def verify_token(token: str):
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        print(f"Error verifying token: {e}")
        return None
