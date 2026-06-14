# Handoff: Integração do MCP de Skills Locais no Dag-Flow

## 1. Contexto e Motivação
Nesta sessão, refatoramos o **`dag-flow-skills-mcp`** para abandonar a busca de *skills* via rede (CDN/Registry.json) e adotar uma arquitetura de **busca puramente local**. O objetivo foi evitar a "poluição" da janela de contexto com dezenas de skills carregadas em todas as sessões por padrão, adotando um modelo de *progressive disclosure* onde as skills ficam armazenadas em `~/.dag-flow/skills/` e são injetadas sob demanda apenas pelos workers que precisarem delas.

## 2. O Que Foi Implementado e Validado
- **Leitura Nativa de Arquivos:** Removemos a biblioteca `ky` e adicionamos `gray-matter` para extrair os metadados (frontmatter) de cada `SKILL.md` via `fs.readdir` e `fs.readFile`.
- **Servidor MCP:** O servidor foi adaptado para expor as três ferramentas (`search_skills`, `read_skill`, e `fetch_skill_files`) operando 100% sobre o sistema de arquivos local (`~/.dag-flow/skills` com fallback para `./.dag-flow/skills`). O build standalone via `esbuild` foi concluído em `mcp/dist/main.js`.
- **Testes de Sandbox Isolado (Worker CLI):** Simulamos a execução assíncrona de um Worker consumindo as skills através da CLI, replicando o ambiente do `run_dag.sh`.
  
## 3. Descobertas Críticas do Sandbox
Durante a simulação de ponta a ponta com a CLI, descobrimos duas barreiras estruturais fundamentais que ditam como a próxima etapa deve ser feita:
1. O comando `gemini` entrava em **Plan Mode** por padrão ao rodar a tool do MCP, bloqueando a execução da *skill* e acusando falta de permissões de execução de script.
2. Ao substituirmos a ferramenta (do CLI `gemini` para o Antigravity CLI `agy`) e adotarmos a flag `--dangerously-skip-permissions`, o Worker conseguiu transpor o *sandbox* e usar as ferramentas MCP livremente para ler o `.md` e extrair o *script.sh* com sucesso absoluto.

## 4. Próximos Passos (Para a Nova Sessão)
Na próxima sessão, o foco será atualizar o núcleo do Orquestrador do `dag-flow` para acomodar esse novo paradigma. Os passos necessários serão:

### A) Atualização do Orquestrador (Tasks Phase)
- O Orquestrador precisará ser instruído a usar a tool `search_skills` durante a fase de **Tasks** (geração do DAG), onde tem visibilidade exata dos inputs/outputs de cada tarefa atômica.
- Quando uma skill pertinente for encontrada, ela deve ser especificada em uma nova coluna na tabela de tarefas do `tasks.md` (ex: `| Skill | codenavi |`).

### B) Atualização do `run_dag.sh` (Execution Phase)
- **Troca de CLI:** Substituir a invocação atual (`gemini --approval-mode auto_edit`) pela CLI do Antigravity (`agy --dangerously-skip-permissions`) para garantir que o Worker tenha permissões executivas ao usar as ferramentas do MCP. *(Nota: Um ADR 0003 foi gerado registrando o trade-off de segurança desta decisão).*
- **Injeção de Prompt Condicional:** O *script* bash precisará ler a coluna de *Skill* do `tasks.md`. A injeção no `$PROMPT` dinâmico do Worker deve ocorrer **apenas se** houver uma skill definida (ignorar se vazio ou `None`). 
  - *Exemplo de injeção:* `"Role: Stateless Worker... Load the skill '$skill_name' using read_skill from the dag-flow-skills MCP before starting your edit."*

## 5. Arquivos de Referência
- **MCP Construído:** `/home/guilherme/Área de trabalho/Repos/dag-flow/mcp/dist/main.js`
- **Registro Global MCP:** `/home/guilherme/.gemini/config/mcp_config.json` (onde o `dag-flow-skills` foi plugado)
- **Exemplo de Skill Base:** `/home/guilherme/.dag-flow/skills/dummy-skill/`
