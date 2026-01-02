#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir cabeçalhos
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Função para verificar erro
check_error() {
    if [ $? -ne 0 ]; then
        echo -e "${RED}[FALHA] $1${NC}"
        # Se passar o segundo argumento como "continue", não encerra o script, apenas marca erro global
        if [ "$2" != "continue" ]; then
            exit 1
        fi
        GLOBAL_ERROR=1
    else
        echo -e "${GREEN}[SUCESSO] $1${NC}"
    fi
}

GLOBAL_ERROR=0

echo -e "${BLUE}Iniciando Verificação de Código (Quality Gate)${NC}"

# ==========================================
# 1. VERIFICAÇÃO PYTHON
# ==========================================
print_header "Verificando Ambiente Python"

# Detectar diretórios Python comuns
PYTHON_DIRS=""
if [ -d "backend" ]; then PYTHON_DIRS="$PYTHON_DIRS backend"; fi
if [ -d "src_gcp" ]; then PYTHON_DIRS="$PYTHON_DIRS src_gcp"; fi
if [ -d "scripts" ]; then PYTHON_DIRS="$PYTHON_DIRS scripts"; fi
if [ -d "python-backend" ]; then PYTHON_DIRS="$PYTHON_DIRS python-backend"; fi

if [ -z "$PYTHON_DIRS" ]; then
    echo -e "${YELLOW}Nenhum diretório Python padrão encontrado (src, src_gcp, python-backend). Buscando arquivos .py na raiz...${NC}"
    if ls *.py 1> /dev/null 2>&1; then
        PYTHON_DIRS="."
    fi
fi

if [ -z "$PYTHON_DIRS" ]; then
    echo -e "${YELLOW}Nenhum código Python detectado para verificação.${NC}"
else
    echo "Diretórios Python detectados: $PYTHON_DIRS"

    # Verificar Black (Formatação)
    echo -e "\n>> Executando Black (Check)..."
    if command -v black &> /dev/null; then
        black --check $PYTHON_DIRS
        check_error "Black Formatting" "continue"
    else
        echo -e "${YELLOW}Black não instalado. Pule.${NC}"
    fi

    # Verificar Ruff (Linting)
    echo -e "\n>> Executando Ruff (Linter)..."
    if command -v ruff &> /dev/null; then
        ruff check $PYTHON_DIRS
        check_error "Ruff Linting" "continue"
    else
        echo -e "${YELLOW}Ruff não instalado. Pule.${NC}"
    fi

    # Verificar Mypy (Tipagem)
    echo -e "\n>> Executando Mypy (Type Checking)..."
    if command -v mypy &> /dev/null; then
        # Check para mypy.ini ou pyproject.toml
        MYPY_ARGS="$PYTHON_DIRS --ignore-missing-imports"
        mypy $MYPY_ARGS
        check_error "Mypy Type Checking" "continue"
    else
        echo -e "${YELLOW}Mypy não instalado. Pule.${NC}"
    fi
fi

# ==========================================
# 2. VERIFICAÇÃO TYPESCRIPT / JAVASCRIPT
# ==========================================
print_header "Verificando Ambiente TypeScript/Node"

if [ -f "frontend/package.json" ]; then
    echo "Projeto Node.js detectado (frontend/package.json encontrado)."
    
    cd frontend || exit

    # Verificar Integridade das Dependências
    echo -e "\n>> Executando Verificação de Dependências (npm ls)..."
    if npm ls --depth=0 >/dev/null 2>&1; then
        check_error "Dependency Integrity" "continue"
    else
        echo -e "${RED}[FALHA] Dependências ausentes ou incompatíveis. Rode 'npm install'.${NC}"
        GLOBAL_ERROR=1
    fi

    # Verificar ESLint
    echo -e "\n>> Executando ESLint..."
    if npm list eslint >/dev/null 2>&1 || npx --no-install eslint --version >/dev/null 2>&1; then
        # Tenta rodar via script do package.json primeiro, fallback para npx
        if npm run | grep -q "lint"; then
            npm run lint
        else
            npx eslint . --ext .ts,.tsx,.js,.jsx
        fi
        check_error "ESLint" "continue"
    else
        echo -e "${YELLOW}ESLint não configurado ou não encontrado.${NC}"
    fi

    # Verificar TypeScript (TSC)
    echo -e "\n>> Executando TSC (Type Check)..."
    if [ -f "tsconfig.json" ]; then
        # Usa modo build (-b) para respeitar referências do projeto
        npx tsc -b
        check_error "TypeScript Compilation (Strict)" "continue"
    else
        echo -e "${YELLOW}tsconfig.json não encontrado. Pulando checagem de tipos.${NC}"
    fi
    
    cd ..
    
else
    echo -e "${YELLOW}Nenhum frontend/package.json encontrado. Pulando verificações Node/TS.${NC}"
fi

# ==========================================
# 3. VERIFICAÇÃO TERRAFORM (Opcional)
# ==========================================
print_header "Verificando Terraform"
if ls *.tf 1> /dev/null 2>&1 || ls **/*.tf 1> /dev/null 2>&1; then
     echo -e "\n>> Executando Terraform fmt..."
     if command -v terraform &> /dev/null; then
        terraform fmt -check -recursive
        check_error "Terraform Format" "continue"
     else
        echo -e "${YELLOW}Terraform CLI não instalado. Pule.${NC}"
     fi
else
    echo -e "${YELLOW}Arquivos Terraform não detectados.${NC}"
fi


# ==========================================
# RESULTADO FINAL
# ==========================================
print_header "Resumo da Verificação"

if [ $GLOBAL_ERROR -eq 0 ]; then
    echo -e "${GREEN}✅ TUDO CERTO! O código segue os padrões.${NC}"
    exit 0
else
    echo -e "${RED}❌ ERROS ENCONTRADOS. Verifique os logs acima e corrija.${NC}"
    exit 1
fi
