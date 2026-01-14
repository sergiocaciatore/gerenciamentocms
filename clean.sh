#!/bin/bash
# Script de limpeza de caches e arquivos temporários Python

set -e

echo "🧹 Iniciando limpeza de arquivos temporários..."

# 1. Python Bytecode
echo "   - Removendo __pycache__ e *.pyc..."
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -type f -name "*.pyc" -delete
find . -type f -name "*.pyo" -delete

# 2. Caches de Ferramentas
echo "   - Removendo caches (.mypy_cache, .ruff_cache, .pytest_cache)..."
rm -rf .mypy_cache
rm -rf .ruff_cache
rm -rf .pytest_cache
rm -rf .coverage
rm -rf htmlcov
rm -rf .tox

# 3. Build artifacts (se houver)
echo "   - Removendo build/dist e egg-info..."
rm -rf build/
rm -rf dist/
find . -type d -name "*.egg-info" -exec rm -rf {} +

echo "✨ Limpeza concluída com sucesso!"
