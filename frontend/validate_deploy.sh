#!/bin/bash
set -e

echo "🚀 Iniciando validação pré-deploy..."

echo "=================================================="
echo "1️⃣  Verificando Linter (ESLint)..."
echo "=================================================="
npm run lint

echo "✅  Lint válido!"
echo ""

echo "=================================================="
echo "2️⃣  Verificando Tipagem e Build (TypeScript + Vite)..."
echo "=================================================="
npm run build

echo ""
echo "🎉  TUDO CERTO! O código está limpo e compilando."
echo "    Pode realizar o deploy com segurança."
echo "=================================================="
