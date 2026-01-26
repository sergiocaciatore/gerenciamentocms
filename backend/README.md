# Backend - Pronto para Cloud Run

Esta aplicação FastAPI foi containerizada para o Google Cloud Run.

## Pré-requisitos

- Python 3.12+ (para desenvolvimento local)
- Docker
- Google Cloud SDK (`gcloud`)

## Desenvolvimento Local (Docker)

Para rodar o container localmente, simulando o ambiente do Cloud Run:

1. **Construir a imagem:**

    ```bash
    docker build -t cms-backend .
    ```

2. **Rodar o container:**

    Você precisa fornecer a variável de ambiente `PORT` (Cloud Run usa 8080 por padrão) e seu ID do Projeto Firebase.

    *Nota: Para autenticação local funcionar sem um arquivo de conta de serviço, certifique-se de ter rodado `gcloud auth application-default login` na sua máquina host, ou monte sua chave de conta de serviço.*

    ```bash
    # Execução básica (falhará na autenticação se não houver credenciais)
    docker run -p 8080:8080 -e PORT=8080 -e FIREBASE_PROJECT_ID=seu-projeto-id cms-backend
    ```

    **Com Credenciais (Recomendado para testes):**
    Se você tiver um `serviceAccountKey.json`, pode montá-lo:

    ```bash
    docker run -p 8080:8080 \
      -e PORT=8080 \
      -e FIREBASE_PROJECT_ID=seu-projeto-id \
      -e GOOGLE_APPLICATION_CREDENTIALS=/tmp/keys/serviceAccountKey.json \
      -v $(pwd)/../serviceAccountKey.json:/tmp/keys/serviceAccountKey.json \
      cms-backend
    ```

## Deploy no Cloud Run

1. **Submeter a build para o Cloud Build:**

    ```bash
    gcloud builds submit --tag gcr.io/PROJECT_ID/cms-backend
    ```

    *Substitua `PROJECT_ID` pelo ID real do seu projeto Google Cloud.*

2. **Implantar o serviço:**

    ```bash
    gcloud run deploy cms-backend \
      --image gcr.io/PROJECT_ID/cms-backend \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --port 8080
    ```

    *Nota: `--allow-unauthenticated` torna a API pública. Remova esta flag se quiser restringir o acesso apenas a usuários IAM autenticados (ex: se estiver usando um Gateway).*

## Configuração

A aplicação usa **Application Default Credentials (ADC)**.

- **No Cloud Run:** O serviço usa a Conta de Serviço anexada (padrão ou personalizada). Garanta que esta conta tenha permissões para:
  - Cloud Firestore User
  - Firebase Authentication Admin
  - Cloud Storage (se necessário)
- **Localmente:** Recorre para `GOOGLE_APPLICATION_CREDENTIALS` ou `gcloud auth application-default login`.

**Variáveis de Ambiente:**

- `PORT`: (Obrigatório) Porta para escutar (injetada pelo Cloud Run).
- `FIREBASE_PROJECT_ID`: (Opcional, mas recomendado) ID do projeto explícito.
- `CORS_ORIGINS`: (Opcional) Lista separada por vírgulas de origens permitidas.
