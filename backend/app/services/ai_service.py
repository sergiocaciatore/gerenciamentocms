import os
import json
from typing import Optional, List, Dict, Any

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None  # type: ignore
from dotenv import load_dotenv
from pathlib import Path
from app.services.ai_tools import AVAILABLE_TOOLS, TOOL_DEFINITIONS

# Inicializar Cliente OpenAI (Inicialização Tardia/Segura)
# Não fazemos cache do cliente globalmente para garantir que o hot-reload de vars de ambiente funcione
# client = None


def get_client():
    # Forçar carregamento do arquivo backend/.env específico
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    load_dotenv(dotenv_path=env_path, override=True)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print(f"DTO-DEBUG: OPENAI_API_KEY não encontrada em {env_path}")
        return None

    if OpenAI is None:
        print(
            "CRÍTICO: biblioteca Python 'openai' não encontrada. Por favor instale (pip install openai)."
        )
        return None

    try:
        # Criar novo cliente a cada vez para garantir que a chave esteja atualizada
        return OpenAI(api_key=api_key)
    except Exception as e:
        print(f"Erro ao inicializar cliente OpenAI: {e}")
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
    message: str,
    history: Optional[List[Dict[str, Any]]] = None,
    config: Optional[Dict[str, Any]] = None,
    user_name: str = "Usuário",
):
    """
    Função principal para lidar com o chat com a IA.
    Executa o loop de uso de ferramentas.
    """
    if history is None:
        history = []

    # --- CONSTRUIR SYSTEM PROMPT DINÂMICO ---
    system_content = BASE_SYSTEM_PROMPT

    # 1. Contexto do Usuário
    intro = config.get("introduction", "") if config else ""
    system_content += f"\n\nCONTEXTO DO USUÁRIO:\nVocê está falando com {user_name}."
    if intro:
        system_content += f"\nO usuário se descreve assim: '{intro}'. Leve isso em consideração para criar intimidade e se adaptar."

    # 2. Configuração de Tom
    tone = (
        config.get("tone", "Estrategista") if config else "Estrategista"
    )  # Padrão para prompt de Estrategista
    tone_instruction = TONE_PROMPTS.get(tone, TONE_PROMPTS["Estrategista"])
    system_content += f"\n\nTOM DE VOZ:\n{tone_instruction}"

    # 3. Preparação Final das Mensagens
    messages = [{"role": "system", "content": system_content}]

    # Adicionar histórico (versão simples, poderia ser otimizada)
    # formato esperado do histórico: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    messages.extend(history)

    # Adicionar mensagem atual do usuário
    messages.append({"role": "user", "content": message})

    client = get_client()
    if not client:
        return "Desculpe, a chave da API OpenAI não está configurada corretamente no backend."

    # 2. Primeira Chamada ao Modelo (Etapa de Decisão)
    response = client.chat.completions.create(
        model="gpt-5-nano",
        messages=messages,
        tools=TOOL_DEFINITIONS,
        tool_choice="auto",
    )

    response_message = response.choices[0].message

    # 3. Verificar Chamadas de Ferramenta
    tool_calls = response_message.tool_calls
    generated_files = []  # Rastrear arquivos criados nesta sessão

    if tool_calls:
        # Adicionar o "pensamento" do assistente (requisição de ferramenta) às mensagens
        messages.append(response_message)

        # Executar cada ferramenta
        for tool_call in tool_calls:
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)

            # Buscar função
            function_to_call = AVAILABLE_TOOLS.get(function_name)

            if function_to_call:
                print(f"AI Calling Tool: {function_name} with args {function_args}")
                try:
                    tool_output = function_to_call(**function_args)

                    # Verificar se esta ferramenta criou um arquivo
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
                        pass  # Não é JSON ou não é uma saída de arquivo

                except Exception as e:
                    tool_output = json.dumps({"error": str(e)})
            else:
                tool_output = json.dumps({"error": "Ferramenta não encontrada"})

            # Adicionar resultado da ferramenta às mensagens
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": function_name,
                    "content": tool_output,
                }
            )

        # 4. Segunda Chamada ao Modelo (Geração de Resposta com Dados)
        final_response = client.chat.completions.create(
            model="gpt-5-nano",
            messages=messages,
            # Ferramentas ainda disponíveis se precisar encadear chamadas (opcional, geralmente uma rodada é suficiente para consultas básicas)
            tools=TOOL_DEFINITIONS,
        )

        return final_response.choices[0].message.content, generated_files

    else:
        # Nenhuma ferramenta necessária, apenas retornar o texto
        return response_message.content, []


def enhance_text(text: str, context: str = "") -> str:
    """
    Melhora o texto com tom técnico, verificação ortográfica e formatação HTML.
    """
    client = get_client()
    if not client:
        return text  # Fallback para o original

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
        print(f"Erro ao melhorar texto: {e}")
        return text
