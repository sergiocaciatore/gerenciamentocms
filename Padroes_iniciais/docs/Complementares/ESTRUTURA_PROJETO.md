# Estrutura do Projeto Mia v2 (Arquitetura Cloud Run)

Este documento descreve a organização técnica do projeto `src gcp`, que segue os princípios de Arquitetura Limpa (Clean Architecture), com separação clara de responsabilidades entre Modelos (Dados), Repositórios (Persistência) e Serviços (Regras de Negócio).

---

## 📂 src gcp/modelos (Domínio e Dados)

Contém as classes que definem as estruturas de dados usadas em todo o sistema. São "Dataclasses" puras, sem lógica de negócio complexa.

* **`estado_sessao.py`**: A "ficha completa" da memória da conversa. Guarda o histórico de mensagens, variáveis coletadas e metadados. É o objeto que trafega entre Redis e IA.
* **`evento_whatsapp.py`**: Padronização do webhook do webhook WhatsApp. Transforma o JSON complexo da Meta em um objeto Python simples (`cliente_id`, `texto`, `tipo`).
* **`lead_mia.py`**: O formulário de qualificação. Define quais campos precisamos coletar (nome, email, telefone, equipamento, etc.) para considerar o lead pronto.
* **`resposta_mia.py`**: A estrutura do que a IA devolve. Contém a mensagem de texto para o usuário, os dados extraídos (JSON) e a lista de campos que ainda faltam.

---

## 📂 src gcp/repositorios (Acesso a Dados)

Responsáveis por salvar e buscar informações em bancos de dados ou cache. O resto do código não sabe "como" os dados são salvos, apenas chama esses métodos.

* **`sessao_redis.py`** (Memória Curta): Gerencia o **Redis**. Salva o objeto `EstadoSessao` com TTL curto (ex: 1 hora) para manter o contexto rápido da conversa durante o papo.
* **`sessao_dynamo.py`** (Memória Longa): Gerencia o **Datastore** (Google Cloud). Salva o "estado macro" do cliente (`etapa`, `timers_disparados`, `status`) para fins de Reengajamento e Histórico duradouro.

---

## 📂 src gcp/servicos (Regras de Negócio)

Onde a mágica acontece. Contém a lógica pesada de processamento, integração e IA.

* **`orquestrador_conversa.py`**: O "Maestro". Recebe o evento, recupera a sessão, chama a IA, atualiza o estado, decide a próxima etapa e prepara a resposta. Coordena todos os outros serviços.
* **`ia_mia.py`**: O "Cérebro". Encapsula a chamada à OpenAI. Constrói o System Prompt (Persona Mia), serializa o histórico e parseia a resposta estruturada (Texto + JSON) da LLM.
* **`normalizador_meta.py`**: O "Tradutor". Recebe o webhook cru do WhatsApp (cheio de aninhamentos) e extrai apenas o que importa (texto, áudio, imagens) para o formato `EventoWhatsApp`.
* **`meta_client.py`**: O "Carteiro". Responsável por enviar mensagens de volta para o WhatsApp API. Sabe fazer requisições HTTP para a Graph API da Meta.
* **`gerenciador_midia.py`**: O "Arquivista". Lida com download de arquivos (áudios, PDFs) do WhatsApp e upload para o Google Cloud Storage (Bucket).
* **`leitor_pdf.py`**: O "Leitor". Extrai texto puro de arquivos PDF para que a IA possa entender o conteúdo de documentos enviados.
* **`publicador_eventos.py`**: O "Megafone". Publica eventos no Google Cloud Pub/Sub para que outros sistemas (CRM, Analytics) saibam o que aconteceu na conversa.
* **`token_provider.py`**: (Legado/Auxiliar) Utilitário para gerenciar tokens de acesso, se necessário.

---

## 📂 Raiz src gcp/ (Entrypoints)

* **`main.py`**: O servidor Web (Flask). É aqui que o Cloud Run conecta. Recebe as requisições HTTP (`/webhook`, `/reengajamento`) e despacha para os handlers.
* **`lambda_mia_conversa.py`**: O Handler principal. Processa mensagens do usuário. Monta as dependências (Redis, Dynamo, Services) e executa o fluxo da conversa.
* **`lambda_mia_reengajamento.py`**: O Handler de Cron. Roda a cada minuto para verificar quem parou de responder e precisa de um "alô".
* **`lambda_canary.py`**: O Handler de Teste. Verifica se OpenAI e Meta API estão respondendo corretamente (Health Check).
