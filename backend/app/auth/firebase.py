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
        # Verificar se o app já está inicializado (ex: por outro worker ou teste)
        firebase_admin.get_app()
        _firebase_initialized = True
        return
    except ValueError:
        pass

    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

    # 1. Tentar arquivo de Conta de Serviço se fornecido
    if service_account_path and os.path.exists(service_account_path):
        import json

        try:
            with open(service_account_path, "r") as f:
                service_account_info = json.load(f)
            cred = credentials.Certificate(service_account_info)
            firebase_admin.initialize_app(cred)
            print(f"Firebase inicializado com conta de serviço: {service_account_path}")
            _firebase_initialized = True
            return
        except Exception as e:
            print(f"Erro ao carregar arquivo de conta de serviço: {e}")
            # Não gerar erro imediatamente, tentar lógica de fallback ADC abaixo

    # 2. Tentar Application Default Credentials (ADC)
    # Isso funciona automaticamente no Cloud Run se a conta de serviço tiver permissão.
    # Também funciona localmente se GOOGLE_APPLICATION_CREDENTIALS estiver definido para um caminho.
    print("Tentando inicializar Firebase com Application Default Credentials (ADC)...")
    try:
        # Podemos passar projectId se disponível, mas o ADC geralmente o descobre.
        # No entanto, para recursos específicos de 'auth', especificar projectId explicitamente é frequentemente mais seguro.
        project_id = (
            os.getenv("FIREBASE_PROJECT_ID")
            or os.getenv("GCLOUD_PROJECT")
            or os.getenv("VITE_FIREBASE_PROJECT_ID")
        )

        if project_id:
            print(f"Inicializando com ADC e projectId: {project_id}")
            firebase_admin.initialize_app(options={"projectId": project_id})
        else:
            print("Inicializando com ADC (sem projectId explícito)...")
            firebase_admin.initialize_app()

        _firebase_initialized = True
        print("Firebase inicializado com sucesso via ADC.")
        return

    except Exception as e:
        print(f"Falha ao inicializar Firebase com ADC: {e}")
        # Falha crítica se não pudermos inicializar
        # raise e  # Opcional: decidir se queremos travar ou executar com funcionalidade limitada

    # Marcar como inicializado para prevenir loop de tentativas falhas repetidas (ou deixar falso para tentar novamente)
    _firebase_initialized = True


# Chamada de inicialização
# initialize_firebase()  <-- Movido para o evento de inicialização em main.py para evitar deadlock na importação


def verify_token(token: str):
    """
    Verifica a validade do token ID do Firebase.

    Args:
        token (str): O token JWT recebido no cabeçalho.

    Returns:
        dict | None: Dados do usuário decodificados se válido, None caso contrário.
    """
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        print(f"Erro ao verificar token: {e}")
        return None
