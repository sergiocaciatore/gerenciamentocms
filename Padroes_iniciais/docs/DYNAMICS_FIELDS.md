# Campos da API Dynamics (Negócios Potenciais)

Documentação consolidada dos campos utilizados na integração.

## Endpoint: POST /negocios-potenciais (Criação)

| Campo | Tipo | Descrição | Exemplo/Valores |
|---|---|---|---|
| `id` | UUID | Identificador único gerado pela aplicação | `550e8400-e29b...` |
| `nome` | String | Nome do negócio | "Oportunidade WhatsApp..." |
| `assunto` | String | Resumo da demanda | "Cotação Plataforma..." |
| `unidade_negocio_interesse.codigo` | String | Código da BU de interesse | `"leves"` |
| `unidade_negocio_proprietaria.codigo` | String | Código da BU proprietária | `"leves"` |
| `status` | String | Status inicial | `"qualificado"` |
| `origem` | String | Canal de entrada | `"whatsapp"` |
| `local_demanda` | Objeto | Dados de localização | Ver abaixo |
| `local_demanda.municipio.nome` | String | Nome da Cidade | "Holambra" |
| `local_demanda.municipio.codigo_ibge` | String | IBGE | "3519055" |
| `local_demanda.estado.sigla` | String | Sigla UF | "SP" |
| `contato.telefone` | String | Telefone (Máscara Obrigatória!) | `(11) 99999-9999` |
| `empresa.cnpj` | String | CNPJ (Opcional) | `12.345.678/0001-90` |
| `utms.pagepath` | String | URL de conversão | `https://site...` |
| `utms.ip` | String | Endereço IP do cliente | `192.168...` |

## Endpoint: POST /negocios-potenciais/{id}/qualificar (Qualificação)

**Status Atual:** Investigação de erro `0x80040265`.

### Campos Esperados (Hipótese/Erro)

O erro "O campo Negócio primário não está preenchido para o usuário" sugere que a ação de qualificar depende da configuração do **Usuário Logado/Serviço** no Dynamics.

| Campo (Action) | Valor Tentado | Erro Retornado |
|---|---|---|
| `mills_buoriginadora` | `"leves"` | "O campo Negócio primário não está preenchido para o usuário" |

### Ação Recomendada

Verificar no Dynamics CRM (Configurações de Usuário) se o usuário de integração possui o campo "Negócio Primário" (Primary Business/Business Unit) preenchido.
