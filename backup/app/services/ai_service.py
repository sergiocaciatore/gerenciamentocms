import os
import json

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None
from dotenv import load_dotenv
from pathlib import Path
from app.services.ai_tools import AVAILABLE_TOOLS, TOOL_DEFINITIONS

# Initialize OpenAI Client (Lazy/Safe Initialization)
# We do not cache the client globally to ensure hot-reload of env vars works
# client = None


def get_client():
    # Force load from the specific backend/.env file
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    load_dotenv(dotenv_path=env_path, override=True)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print(f"DTO-DEBUG: OPENAI_API_KEY not found in {env_path}")
        return None

    if OpenAI is None:
        print(
            "CRITICAL: 'openai' Python library not found. Please install it (pip install openai)."
        )
        return None

    try:
        # Create fresh client each time to ensure key is current
        return OpenAI(api_key=api_key)
    except Exception as e:
        print(f"Error initializing OpenAI client: {e}")
        return None


BASE_SYSTEM_PROMPT = """
Você é um AI Assistant especialista em Gerenciamento de Engenharia para um Sistema de Gestão de Obras (CMS).
Seu objetivo é ajudar gerentes de projeto e engenheiros respondendo perguntas sobre obras em andamento, fornecendo conselhos estratégicos e auxiliando no planejamento.

VOCABULÁRIO IMPORTANTE:
- "Golive": Data em que a obra deve ser entregue e entrar em operação.

Você tem acesso ao banco de dados do projeto através de ferramentas:
- SEMPRE use `get_all_works` primeiro se precisar encontrar o ID de uma obra mas não souber.
- Use `get_work_details` para obter endereço, status, datas e outras informações.
- Use `get_work_planning` para ver o status atual do planejamento (cronograma).
- Use `get_lpu_data` para consultar itens da LPU, preços e limites.
- Use `get_control_tower_data` para obter uma visão geral das Ocorrências (OCs) e eventos críticos.
- Use `get_team_members` para saber quem são os residentes e responsáveis.
- Use `get_daily_logs` para ler o diário de obra.
- Use `get_managements` para acessar relatórios gerenciais e status financeiros/KPIs.

Ao responder:
1. Seja profissional, conciso e prestativo.
2. Se faltarem dados (por exemplo, data nula), mencione isso claramente.
3. Se estiver criando um relatório ou estratégia, use os dados disponíveis para justificar suas recomendações.
4. Fale sempre em Português (Brasil).
"""

TONE_PROMPTS = {
    "Técnico": "Adote uma postura TÉCNICA. Foque em valores, contas, cálculos, datas precisas e detalhes de execução. Seja direto e analítico.",
    "Estrategista": "Adote uma postura ESTRATEGISTA. Identifique possíveis erros, preveja problemas futuros, analise riscos e sugira caminhos de longo prazo. Seja crítico e visionário.",
    "Ideias": "Adote uma postura CRIATIVA (Ideias). O usuário pode estar perdido. Ofereça brainstorming, soluções inovadoras e alternativas fora da caixa para destravar problemas.",
    "Gestor": "Adote uma postura de GESTOR. Foque em prazos, stakeholders, milestones, organização de equipe e visão macro do progresso. Ajude a organizar a casa.",
}


def chat_with_data(
    message: str, history: list = None, config: dict = None, user_name: str = "Usuário"
):
    """
    Main function to handle chat with the AI.
    Executes the tool-use loop.
    """
    if history is None:
        history = []

    # --- BUILD DYNAMIC SYSTEM PROMPT ---
    system_content = BASE_SYSTEM_PROMPT

    # 1. User Context
    intro = config.get("introduction", "") if config else ""
    system_content += f"\n\nCONTEXTO DO USUÁRIO:\nVocê está falando com {user_name}."
    if intro:
        system_content += f"\nO usuário se descreve assim: '{intro}'. Leve isso em consideração para criar intimidade e se adaptar."

    # 2. Tone Configuration
    tone = (
        config.get("tone", "Estrategista") if config else "Estrategista"
    )  # Default to Strategist prompt
    tone_instruction = TONE_PROMPTS.get(tone, TONE_PROMPTS["Estrategista"])
    system_content += f"\n\nTOM DE VOZ:\n{tone_instruction}"

    # 3. Final Prepare Messages
    messages = [{"role": "system", "content": system_content}]

    # Add history (simple version, could be optimized)
    # history expected format: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    messages.extend(history)

    # Add current user message
    messages.append({"role": "user", "content": message})

    client = get_client()
    if not client:
        return "Desculpe, a chave da API OpenAI não está configurada corretamente no backend."

    # 2. First Call to Model (Decision Step)
    response = client.chat.completions.create(
        model="gpt-5-nano",
        messages=messages,
        tools=TOOL_DEFINITIONS,
        tool_choice="auto",
    )

    response_message = response.choices[0].message

    # 3. Check for Tool Calls
    tool_calls = response_message.tool_calls
    generated_files = []  # Track files created in this session

    if tool_calls:
        # Append the assistant's "thought" (tool call request) to messages
        messages.append(response_message)

        # Execute each tool
        for tool_call in tool_calls:
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)

            # Look up function
            function_to_call = AVAILABLE_TOOLS.get(function_name)

            if function_to_call:
                print(f"AI Calling Tool: {function_name} with args {function_args}")
                try:
                    tool_output = function_to_call(**function_args)

                    # Check if this tool created a file
                    try:
                        output_data = json.loads(tool_output)
                        if (
                            isinstance(output_data, dict)
                            and output_data.get("type") == "document_created"
                        ):
                            generated_files.append(
                                {
                                    "file_id": output_data.get("file_id"),
                                    "filename": output_data.get("filename"),
                                }
                            )
                    except Exception:
                        pass  # Not JSON or not a file output

                except Exception as e:
                    tool_output = json.dumps({"error": str(e)})
            else:
                tool_output = json.dumps({"error": "Tool not found"})

            # Append tool result to messages
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": function_name,
                    "content": tool_output,
                }
            )

        # 4. Second Call to Model (Response Generation with Data)
        final_response = client.chat.completions.create(
            model="gpt-5-nano",
            messages=messages,
            # Tools are still available if it needs to chain calls (optional, usually one round is enough for basic queries)
            tools=TOOL_DEFINITIONS,
        )

        return final_response.choices[0].message.content, generated_files

    else:
        # No tool needed, just return the text
        return response_message.content, []


def enhance_text(text: str, context: str = "") -> str:
    """
    Enhance text with technical tone, spellcheck, and HTML formatting.
    """
    client = get_client()
    if not client:
        return text  # Fallback to original

    system_prompt = """
    Você é um Editor Técnico Sênior de Engenharia.
    Sua função é revisar, corrigir e formatar textos de relatórios de obras.
    
    DIRETRIZES:
    1. CORREÇÃO: Corrija ortografia e gramática.
    2. TOM TÉCNICO: Mantenha siglas como "PP", "CT", "PO", "SLA" etc. NÃO INVENTE significados (ex: não troque PP por Parceiro Comercial). Use uma linguagem direta e executiva.
    3. FORMATAÇÃO HTML:
       - Use <b>...</b> para destacar pontos chave, valores e prazos críticos.
       - Use <span style="color: #dc2626">...</span> (vermelho) para riscos, atrasos ou bloqueios.
       - Use <span style="color: #16a34a">...</span> (verde) para conclusões, sucessos ou liberações.
       - Use <br/> para quebras de linha se necessário.
    4. ESTRUTURA: Se o texto for longo, organize em tópicos (<ul><li>...</li></ul>).
    5. RESUMO: Se o texto for confuso, reescreva de forma mais clara mas sem perder informação.
    6. SÓ DESTAQUE NO TEXTO EM CORES DIFERENTES OU NEGRITO O QUE É DE FATO RELEVANTE.

    Não use dados como esse explicando o contexto, por exemplo: 
    Contexto: Obra: SRS9 - NOVA SANTA RITA. Regional: Sul, mas você pode colocar Revisão {hoje}
    
    Retorne APENAS o HTML do texto melhorado, sem conversa fiada.
    """

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Texto Original: {text}\nContexto: {context}"},
    ]

    try:
        response = client.chat.completions.create(model="gpt-5-nano", messages=messages)
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error enhancing text: {e}")
        return text
