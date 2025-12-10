# Monorepo: Firebase Auth MVP (FastAPI + React)

Este projeto é um MVP de autenticação usando Firebase Auth com Google Login, Backend FastAPI e Frontend React + Vite.

## Pré-requisitos

- Node.js (v18+)
- Python (v3.9+)
- Conta no Firebase Console

## Configuração do Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. **Authentication**: Ative o método de login "Google".
3. **Configurações do Projeto**:
   - Gere uma nova chave privada em "Service Accounts" -> "Generate new private key".
   - Salve o arquivo como `serviceAccountKey.json` na **raiz** deste projeto (fora de `backend` e `frontend`).
   - **IMPORTANTE**: Nunca commite este arquivo!
4. **Web App**:
   - Adicione um app web ao projeto.
   - Copie as configurações do SDK (apiKey, authDomain, etc).

## Backend (FastAPI)

O backend valida o token do Firebase e retorna informações do usuário.

### Configuração

1. Navegue até a pasta `backend`:
   ```bash
   cd backend
   ```
2. Crie um ambiente virtual e instale as dependências:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Linux/Mac
   # .venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   ```
3. Configure as variáveis de ambiente (opcional, pois o padrão busca na raiz):
   - Copie `.env.example` para `.env` se precisar alterar o caminho da service account.

### Rodar

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

O backend estará rodando em `http://localhost:8000`.
- Health check: `http://localhost:8000/health`
- Endpoint protegido: `http://localhost:8000/me` (Requer Header `Authorization: Bearer <token>`)

## Frontend (React + Vite)

O frontend gerencia o login e exibe os dados do usuário.

### Configuração

1. Navegue até a pasta `frontend`:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente:
   - Copie `.env.example` para `.env`.
   - Preencha com as credenciais do seu projeto Firebase:
     ```env
     VITE_FIREBASE_API_KEY=seu_api_key
     VITE_FIREBASE_AUTH_DOMAIN=seu_project.firebaseapp.com
     VITE_FIREBASE_PROJECT_ID=seu_project_id
     VITE_FIREBASE_APP_ID=seu_app_id
     VITE_API_BASE_URL=http://localhost:8000
     ```

### Rodar

```bash
npm run dev
```

O frontend estará rodando em `http://localhost:5173`.

## Fluxo de Uso

1. Abra o frontend (`http://localhost:5173`).
2. Se não estiver logado, será redirecionado para `/login`.
3. Clique em "Entrar com Google".
4. Após o login, você será redirecionado para a Home.
5. A Home fará uma requisição ao backend (`/me`) usando o token obtido.
6. Os dados do usuário (retornados pelo backend) serão exibidos.

## Docker (Dev)

Para rodar todo o ambiente (Backend + Frontend) com Docker Compose:

1. Certifique-se de ter o Docker e Docker Compose instalados.
2. Certifique-se de que o arquivo `serviceAccountKey.json` está na raiz do projeto.
3. Execute:
   ```bash
   docker compose up --build
   ```

- **Frontend**: http://localhost:5173
- **Backend Health**: http://localhost:8000/health

**Nota**: O arquivo `serviceAccountKey.json` é montado como volume no container do backend. Nunca commite este arquivo.

### Resetando o Ambiente (Importante)

Se você encontrar erros como "Cannot find module @rollup/rollup-linux-arm64-musl" ou problemas com `node_modules`, siga estes passos para limpar o ambiente e reconstruir:

1. Pare os containers e remova os volumes:
   ```bash
   docker compose down -v
   ```
2. (Opcional) Remova `node_modules` local do frontend para evitar confusão:
   ```bash
   rm -rf frontend/node_modules frontend/package-lock.json
   ```
3. Reconstrua e suba novamente:
   ```bash
   docker compose up --build
   ```


Seção de filtros:
Filtros ficará abaixo de ações no mesmo padrão do restante
Uusuário vai poder digitar qualquer coisa para exibir site, regional, endereço, etc
Intervalo de data - nesse filtro o usuário tem que definir um intervalo de data, quando ele selecionar essa data ele irá exibir os

