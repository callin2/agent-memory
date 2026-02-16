
ChatGPT와 익명 간의 대화의 사본입니다.
대화 신고하기
나의 말:
i want research about  ai agent memory system to persist almost dialog between ai agent and others(human, another agents) while keep active llm context small. "active llm context" means whole memory and context is not capable to send one llm api call, active llm context is curated context via variouse algorithm and huristic for one llm api call

ChatGPT의 말:
Good. You’re asking the right question.
You want near-total dialog persistence, but only a small, curated “active LLM context” per call.

That is essentially the core systems problem of modern AI agents.

Below is a structured technical research report:

1. Problem Definition
Objective
Design an AI agent memory system that:
Persists almost all dialogue (human ↔ agent, agent ↔ agent)
Keeps long-term memory
Supplies only a small, optimized “active context” to each LLM API call
Maintains coherence and identity over long time horizons
Minimizes hallucination and token cost
Definitions
Total Memory Space
Complete dialogue history
Structured state
Tool results
External data
Derived knowledge
Agent self-model
Active LLM Context
A curated subset of total memory
Compressed + prioritized
Fits within token limits
Optimized for a specific call
The challenge:
How do we compress, select, retrieve, and transform total memory into minimal but sufficient context?
2. Core Architectural Patterns
Pattern 1 — Retrieval-Augmented Memory (RAG-based Agent Memory)
Idea
Store all conversation. Retrieve only relevant chunks.
Architecture
Persistent Store
 ├─ raw transcripts
 ├─ vector embeddings
 ├─ structured summaries
 └─ metadata index

Query → semantic retrieval → filtered → injected into context
Techniques
Embedding similarity search
Time-decay weighting
Recency bias
Conversation topic clustering
Pros
Simple
Scalable
Production-ready
Cons
Loses reasoning chains
Retrieval noise
Embedding drift over time
Pattern 2 — Hierarchical Memory (Tree Compression)
Inspired by:
conversation summarization research
recursive compression
tree-of-thought reasoning
Structure
Raw Dialogue
   ↓
Session Summaries
   ↓
Episode Summaries
   ↓
Identity/Principle Memory
Each level compresses the previous.
Key Property
Lower levels are rarely accessed.
Higher levels are small and stable.
Active Context Composition
Active Context =
    Current turn
  + Recent dialogue window
  + Retrieved semantic memory
  + Compressed long-term summary
Strength
Balances compression + semantic recall.
Pattern 3 — Event-Sourced Memory (Decision-Transition Model)
Instead of storing text,
store structured transitions:
{
  timestamp
  speaker
  intent
  constraints
  decision
  alternatives
  outcome
}
This preserves reasoning.
Advantage
You don’t replay full text.
You replay decisions.
This significantly reduces context size.

Pattern 4 — Graph Memory (Knowledge Graph + Dialogue Graph)
Represent memory as:
Nodes: concepts, users, agents, goals
Edges: interactions, causality, references
Graph query replaces vector search.
Used in:

advanced cognitive agents
research agents
autonomous planners
Pattern 5 — Multi-Store Memory Architecture
Best modern systems combine:
Memory Type	Storage	Purpose
Episodic	raw transcript	audit + replay
Semantic	vector DB	retrieval
Procedural	rule store	agent behavior
Identity	compact summary	personality continuity
Working	in-RAM	short term
This mirrors cognitive psychology.
3. Active Context Construction Algorithms
This is the most important section.
You need a Context Orchestrator.

Algorithm 1 — Relevance + Recency Hybrid
Score memory chunks by:
score = α * semantic_similarity
      + β * recency_decay
      + γ * importance_score
Top-K injected.
Algorithm 2 — Intent-Aware Context Curation
Steps:
Classify current user intent
Predict required knowledge types
Retrieve only relevant memory classes
Example:
If user asks:

"Why did we choose this architecture?"
System retrieves:
past decision records
constraints
alternatives considered
Not entire chat history.
Algorithm 3 — Dynamic Summary Regeneration
If context budget exceeded:
Merge older segments
Regenerate compressed summary
Replace detailed history with abstraction
Recursive compression.
Algorithm 4 — Attention Simulation
Train lightweight model to predict:
“What memory would human bring into working memory?”
Approximate working memory model.

4. Cutting-Edge Research Directions (2024–2026)
A. Memory as Latent State (Recurrent LLM)
Some frontier models explore:
persistent hidden state
external state tokens
streaming attention
But still experimental.
B. Learned Memory Controllers
Instead of heuristics:
Train small model to:

select memory chunks
compress dynamically
predict retrieval success
Meta-learning approach.
C. Memory Distillation
Convert long conversations into:
principles
policy rules
reusable abstractions
Reduces token usage dramatically.
D. Self-Reflection Loops
Agent periodically runs:
What have I learned?
What is reusable?
What should be forgotten?
Memory pruning is essential.
5. Failure Modes
You must guard against:
Context Drift
Embedding semantic collapse
Recursive summary error accumulation
Identity mutation
Retrieval hallucination
Long-term systems degrade without maintenance.
6. Recommended Architecture (Practical + Advanced Hybrid)
If I were building this today:
Storage Layer
Append-only event log (ground truth)
Vector DB (semantic retrieval)
Structured decision store (JSON)
Identity + principles store
Processing Pipeline
On each turn:
Parse new message
Classify intent
Retrieve relevant episodic memory
Retrieve decision memory
Merge identity summary
Construct minimal context
Call LLM
Store result
Run background compression
Active Context Template
[System Identity Summary]

[Current Goal]

[Relevant Past Decisions]

[Recent Dialogue Window]

[User Message]
Everything else stays outside.
7. Token Cost Control Strategy
Use strict budget allocation:
Component	Token Budget
Identity	300
Goal State	200
Retrieved Memory	800
Recent Dialogue	1000
System Prompt	500
User Input	variable
Hard limits prevent explosion.
8. Research Evaluation Metrics
You should measure:
Long-term coherence
Recall accuracy
Token efficiency
Identity stability
Decision replay fidelity
Retrieval precision/recall
Without metrics, memory systems silently fail.
9. Future Outlook
The winning architecture likely includes:
hierarchical compression
event-based storage
graph structure
learned memory selection
background reflection jobs
LLMs alone are insufficient.
The real intelligence is in the memory controller.
10. If You Want to Go Deeper
We can next:
Design a formal memory specification
Define memory schemas
Define compression algorithms
Compare OpenClaw / Claude Code / Codex memory strategies
Or design a filesystem-based TypeScript implementation blueprint
Your direction will determine the next layer.
Where do you want to go:

theoretical research expansion
production architecture design
cognitive modeling
experimental evaluation framework
or spec document drafting
Pick one.

나의 말:
this is prev research ressult. you must read this.
----
AI 에이전트 메모리 구조 비교: OpenClaw vs Claude Code vs Oh-My-OpenCode
개요

대형언어모델(LLM)을 기반으로 한 AI 에이전트들은 기본적으로 개별 세션을 넘어서 맥락을 기억하지 못한다. 이러한 한계를 극복하기 위해 최근 등장한 OpenClaw, Claude Code, Oh-My-OpenCode와 같은 시스템들은 지속적 메모리(persistent memory) 구조를 도입하여, 이전 대화와 사용자 환경 정보를 보존하려 한다. 아래에서는 세 시스템 각각에 대해 "왜" 장기 메모리가 필요했는지, "어떤" 메모리 구조로 무엇을 기억하는지, "어떻게" 기술적으로 구현하여 활용하는지를 살펴보고, 이들의 메모리 설계를 비교한 후 향후 발전 방향을 논한다.

OpenClaw (AI 에이전트 프레임워크)

Why (필요성): OpenClaw는 PC에서 24/7 상시 실행되는 자율 에이전트로, 사용자 대신 작업을 수행하는 것이 특징이다. 따라서 일반적인 챗봇처럼 매 세션마다 기억이 초기화되면 연속 업무가 불가능하다. 개발 초기에 OpenClaw 에이전트는 세션 간 상태를 유지하지 못해 사용자가 직접 중요한 컨텍스트를 다시 불러와야 하는 불편이 있었고, 장시간 작업 시 이전 결정 맥락을 잃어버리는 문제가 제기되었다. 이를 해결하고 “며칠 간격으로도 대화를 이어갈 수 있는” 에이전트를 만들기 위해 장기 기억 구조가 도입되었다.

What (메모리 구조): OpenClaw는 파일 시스템 기반의 2계층 메모리를 갖는다:

일일 로그 (memory/YYYY-MM-DD.md): 그 날의 대화와 행동을 append-only로 기록한 단기 기록지로, 최근 1~2일치 로그를 매 세션 시작 시 불러와 최신 맥락을 제공한다.

장기 메모리 (MEMORY.md): 사용자의 선호, 프로젝트 규칙, 중요 결정 사항 등 변하지 않는 핵심 정보를 요약하여 보관한 파일로, 개인 프라이빗 세션에서만 로드된다 (공개 채널 대화 시에는 민감 정보 노출 방지를 위해 로드 안 함).

세션별 전체 기록 (sessions/YYYY-MM-DD-<slug>.md): 선택적으로 저장되는 대화 전문 아카이브로, 설정 시 과거 몇 주 전 대화까지 검색할 수 있도록 보존된다.

모든 메모리는 사람이 읽을 수 있는 Markdown 문서로 남기며, 에이전트가 “기억”하는 내용은 곧 이 파일들에 기록된 내용이다.

How (구현 방식): OpenClaw는 메모리 파일들을 효율적으로 활용하기 위해 다음과 같은 기술을 사용한다:

로컬 파일 저장 및 로드: 메모리는 로컬 디스크에 평문으로 저장되고, 에이전트 구동 시 필요한 파일을 열어 모델 프롬프트에 포함한다. 덕분에 사용자가 메모리 내용을 직접 열람/편집할 수 있어 투명성이 높다.

하이브리드 검색 인덱스: 대화 중 이전에 저장된 정보를 찾아야 할 때, OpenClaw는 SQLite 기반의 벡터 임베딩 검색(70% 가중치)과 키워드 BM25 검색(30% 가중치)을 결합해 관련 내용을 조회한다. 벡터 유사도가 높지만 키워드 매치가 없는 항목도 결과에 포함하여(교집합 아닌 합집합) 개념적으로 연관된 기억까지 놓치지 않는다.

메모리 인덱싱 & 임베딩: 메모리 파일들은 약 400토큰 단위로 청크화되어 임베딩이 생성되고 SQLite DB에 저장된다. 우선 순위는 로컬 임베딩 모델 → OpenAI API → Google Gemini 순으로 provider를 자동 선택하며, 모두 실패하면 BM25만으로도 검색하도록 설계되었다.

자동 컨텍스트 flush: 대화가 진행되어 컨텍스트 창이 한계에 가까워지면 (예: 200K 중 176K 토큰 시점) OpenClaw는 모델에게 중요 내용을 메모리 파일에 저장하도록 암시적 프롬프트를 보낸다. 이렇게 flush를 수행한 뒤 요약(compaction) 절차가 진행되므로, 컨텍스트 압축으로 일부 대화 기록이 지워져도 핵심 내용은 미리 영구 저장된 상태다.

플러그인 확장: OpenClaw의 기본 메모리는 로컬 머신에 국한되지만, 플러그인으로 기능을 확장할 수 있다. 예를 들어 Mem0 플러그인을 통해 클라우드 기반 장기메모리를 도입하면 세션 재시작 후에도 바로 이전 맥락을 복구하고, 대화 매 턴마다 관련 기억을 자동 주입하는 등 향상된 persistency를 얻을 수 있다. 이외에도 그래프 DB나 PostgreSQL을 활용하는 서드파티 메모리 확장들이 존재한다.

Claude Code (Anthropic의 코딩 특화 LLM 시스템)

Why (필요성): Anthropic의 Claude Code는 코드 작성 및 리팩토링 보조에 특화된 에이전트 환경이다. 개발자들은 매 세션마다 프로젝트 구조나 코딩 스타일을 반복 설명하는 비효율을 줄이고, 긴 코딩 작업 동안 AI가 앞부분에 내린 결정들을 계속 기억해주길 원했다. 예를 들어 여러 파일에 걸친 리팩토링이나 며칠에 나눠 진행하는 프로젝트에서, 문맥 창 한계를 넘어서는 장기적 일관성이 필요하므로 Claude Code에는 세션 간 지속되는 메모리 기능이 도입되었다.

What (메모리 구조): Claude Code의 메모리는 명시적 지식 파일과 자동 생성 노트의 이중 구조이다:

CLAUDE.md 계층 구조: Claude는 프로젝트 폴더 및 사용자 디렉토리에 위치한 CLAUDE.md 파일들을 메모리로 활용한다. 이 파일들은 조직 전체 정책(엔터프라이즈), 특정 프로젝트 지침, 사용자별 선호, 개인별 프로젝트 설정 등 여러 계층으로 존재하며, 우선순위에 따라 계층적으로 적용된다. 예컨대 회사 코딩 규칙(전사 메모리) → 해당 프로젝트의 아키텍처 및 코드 컨벤션(프로젝트 메모리) → 사용자의 코딩 습관(사용자 메모리) 순으로 병합되며, 구체적인 하위 규칙이 상위 규칙보다 우선한다. 이 파일들은 사용자가 직접 작성/관리하는 것으로, Claude에게 매 세션 초기에 주입되어 일종의 고정 시스템 프롬프트 역할을 한다.

자동 메모리 (Auto memory): Claude Code는 에이전트 스스로 학습한 내용을 저장하는 프로젝트별 메모리 디렉토리를 유지한다. 예를 들어 ~/.claude/projects/<project>/memory/ 아래에 MEMORY.md라는 요약 파일과 debugging.md, api-conventions.md 등의 토픽별 보조파일을 만들고, 코딩 세션 중에 발견한 패턴이나 중요한 정보를 기록한다. MEMORY.md는 해당 프로젝트에서 Claude가 터득한 지식의 인덱스이며, 여기에 빌드/테스트 방법, 자주 발생한 오류와 해결법, 설계상의 핵심 등이 간결히 정리된다. 자동메모리는 Claude가 코드 작업을 하며 추출한 내용이므로 사용자가 일일이 가르칠 필요 없이 점진적으로 축적된다. 단, 컨텍스트 관리상 MEMORY.md의 처음 200라인만 매 세션 자동로드하고, 상세 내용은 Claude가 필요할 때 파일을 열어보는 방식으로 효율화한다.

대화 히스토리 및 요약: Claude Code 역시 긴 대화(session) 내에서 작업 메모리를 관리한다. 컨텍스트 창(최대 100K~200K 토큰)이 가득 차기 전에 자동으로 이전 대화 내용을 요약해 압축하고 새 세션 컨텍스트로 이어가는 compaction 기능이 존재한다. 또한 최근 N개의 관련 파일 내용은 요약 후에도 계속 컨텍스트에 유지하여 코드 작업의 일관성을 보장한다. 이러한 요약본은 일종의 간이 메모리로서 작용하여, 세션 도중에도 모델이 앞부분 내용을 최대한 잊지 않도록 돕는다.

How (구현 방식): Claude Code는 초대형 컨텍스트 창과 파일 기반 메모리를 적극 활용하는 접근을 취한다:

컨텍스트에 직접 로드: Anthropic이 선택한 방법은 RAG처럼 외부 DB를 질의하는 대신, 아예 모든 메모리 파일 내용을 프롬프트 맥락에 집어넣는 것이다. Claude의 100K+ 토큰 컨텍스트에 사용자 작성 CLAUDE.md들과 Claude가 축적한 MEMORY.md 요약을 모두 포함시켜, 모델이 필요한 부분을 자연어 이해로 찾아내도록 하는 구조다. 이는 일종의 “문맥적 검색”으로, 벡터 DB를 거치지 않는 대신 메모리 내용 선별의 책임이 사용자와 모델에게 있다. 이 접근은 투명성과 제어성을 높여주지만, 반대로 방대한 메모리가 들어간 상태에서는 모델이 관련 정보를 픽업하기 어려워지는 문맥 희석 문제가 보고되고 있다. 따라서 Anthropic 측은 메모리 파일을 가급적 작고 중요내용 중심으로 유지하고, 큰 문서는 필요 시 링크(@파일명)로 불러쓰는 메모리 모듈화를 권장하고 있다.

대화 요약 및 편집: Claude Code 엔진은 세션 중 자동 compaction 외에도 맥락 편집(context editing) 기능을 도입했다. 이는 대화 내 쌓인 툴 사용 결과 등 군더더기 요소를 제거하고 중요한 대화맥락은 남기는 자동 필터로, 2025년 업데이트에서 성능을 크게 높였다. 덕분에 이전에는 컨텍스트 한계 근처에서 모델 성능이 급격히 떨어지던 현상이 완화되고, compaction도 여유 있게 (대략 75% 채워지면) 조기 실행되어 모델이 충분한 작업 메모리를 확보하도록 개선되었다.

파일 접근 툴: Claude Code는 코딩 작업을 위해 파일시스템 툴을 제공한다. 예를 들어 프로젝트 내 glob 패턴으로 특정 파일을 찾거나, grep으로 키워드를 검색하여 관련 코드를 읽어오는 Just-in-Time 정보획득이 가능하며, 이를 통해 모든 코드파일을 처음부터 메모리에 넣지 않고도 필요할 때 열람하여 컨텍스트에 추가한다. 이 방식은 최신 정보 사용과 토큰 절약 두 측면에서 효과적이다.

메모리 쓰기/편집 도구: Claude Code 플랫폼에는 메모리 파일을 다루는 명령도 있다. /memory 명령을 통해 메모리 파일들을 직접 열어 편집하거나, 대화 중에 #memory 툴을 호출하여 Claude가 새로운 사실을 MEMORY.md 등에 기록하게 하는 식이다. 예컨대 “앞으로 새 프로젝트에는 TypeScript를 선호한다” 라고 사용자가 말하면, Claude가 이를 기억하고 /memories/preferences.txt 등에 저장해두는 식이다.

보안 및 분리: Claude Code 메모리는 기본적으로 프로젝트마다 분리되어 하나의 프로젝트에서 학습한 내용이 다른 프로젝트 세션에 섞여 나오지 않도록 설계되었다. 또한 기업용 버전에서는 조직 단위로 메모리 파일을 중앙 관리하는 Managed policy (엔터프라이즈 전체 보안지침)부터, 특정 팀/프로젝트 메모리, 개인 메모리까지 계층적 접근제어를 적용할 수 있다. 아울러 민감한 대화는 기록에 남지 않도록 Incognito 모드를 제공하는 등, 장기 메모리로 인한 정보유출 위험을 제어하려는 장치들도 마련되어 있다.

Oh-My-OpenCode 플러그인 (ChatGPT/VSCode 기반 에이전트)

Why (필요성): OpenCode는 오픈소스로 개발된 터미널 기반 AI 코딩 에이전트로, 하나의 에이전트가 “Plan” (계획)과 “Build” (구현) 두 가지 역할로 나뉘어 동작한다. 그러나 현대의 복잡한 소프트웨어 개발에서는 아키텍처 설계, 코드 작성, 문서화, 디버깅 등 여러 전문 영역이 병렬로 진행된다. Oh-My-OpenCode는 이러한 필요에 맞춰 여러 명의 AI 개발자들이 협업하는 개념을 도입한 플러그인이다. 멀티에이전트 협업에서는 각 에이전트가 맡은 작업의 맥락과 결과를 다른 에이전트들도 알아야 하므로, 개별 에이전트 메모리뿐 아니라 공유 메모리 구조가 특히 중요하다. 또한 OpenCode 기본 설정만으로는 세션 재시작 시 맥락이 초기화되어 장기 프로젝트에 불편이 있었는데, 이를 개선하고자 Oh-My-OpenCode 생태계에서는 지속 메모리와 컨텍스트 관리에 대한 여러 도구를 마련했다.

What (메모리 구조): Oh-My-OpenCode는 OpenCode의 기본 메모리 체계를 확장하며, 다음 요소들로 구성된다:

프로젝트 메모리 파일 (AGENTS.md): OpenCode는 프로젝트 폴더에 AGENTS.md 파일을 두어 해당 프로젝트의 문맥과 규칙을 정의한다. 이 파일은 글로벌/프로젝트/폴더 3단계로 구분된 지침을 담고 있어, 사용자 개인 코딩 스타일(글로벌) → 해당 프로젝트의 기술 스택/아키텍처(프로젝트) → 특정 디렉토리의 규칙(폴더) 순으로 계층화된다. 설정 후에는 “반복 설명 없이도” 에이전트가 프로젝트 맥락을 기억하게 되며, 이 파일을 Git 등에 공유함으로써 팀원들과 에이전트가 동일한 지식을 갖추게 한다.

세션 대화 로그: OpenCode 에이전트는 터미널 세션마다 대화와 실행 내역을 메모리에 유지한다. opencode --continue 명령으로 이전 세션의 대화를 이어받을 수 있고, /compact 명령으로 누적 대화를 요약하여 다음 세션에 넘기는 기능이 있다. 이를 통해 하루를 넘겨도 작업 컨텍스트를 이어갈 수 있고, 긴 대화는 압축 요약본으로 교체하여 토큰 한도를 관리한다.

할일 목록 및 진행 상태: Oh-My-OpenCode의 핵심인 오케스트레이터 Sisyphus는 사용자의 큰 요청을 세분화한 to-do 리스트를 작성하고, 각 항목을 전문 에이전트들에게 할당한다. 이 때 Sisyphus는 모든 작업의 전후 관계와 완료 상태를 기억하여, 어떤 에이전트가 무엇을 끝냈고 무엇을 아직 해야 하는지 추적한다. Sisyphus에는 *“Todo Continuation Enforcer”*라는 메커니즘이 있어 남은 할일이 있으면 에이전트들이 중간에 멈추지 않고 이어서 하도록 강제해준다. 이는 멀티에이전트 시스템 전체의 장기 메모리 역할을 수행하여, 중복 작업이나 누락을 방지한다.

에이전트별 지식 공유: Oh-My-OpenCode에는 Oracle(설계 담당), Librarian(문서/예시 검색), Navigator(코드 구조 파악), Implementer(코드 작성) 등 7가지 이상의 전문 에이전트가 있다. 이들은 각자 빠른 모델부터 정확한 모델까지 다양한 LLM을 활용하며, Librarian이 찾아낸 문서나 Navigator가 구축한 코드 맵 등의 정보는 필요 시 공동 메모리로 활용된다. 이를테면 Navigator가 생성한 프로젝트 파일 구조와 의존성 정보는 Implementer에게 전달되어 일관된 코드 작성에 쓰이고, Oracle이 결정한 아키텍처 원칙은 다른 에이전트들의 행동 지침으로 공유된다. 이런 부분적 공유 메모리를 통해 팀으로서 일관성을 유지한다.

How (구현 방식): Oh-My-OpenCode는 OpenCode 기반이므로 기본적으로 파일+세션 기반 메모리 관리를 따르면서, 멀티에이전트 특성에 맞게 추가 기능들을 구현한다:

AGENTS.md 자동 로드: OpenCode 에이전트는 실행 시 사용자 홈의 글로벌 agents.md와 프로젝트의 AGENTS.md를 읽어들여 시스템 프롬프트로 통합한다. 또한 하위 폴더별 세부 규칙(.opencode/ 하위 경로)도 파일 경로에 따라 자동 적용되어, 에이전트들이 파일 편집 시 해당 부분의 컨텍스트를 인지할 수 있게 한다. 이처럼 계층적 규칙을 병합하여 메모리에 올리므로, 에이전트 간 공통된 세계관을 형성한다.

세션 관리와 공유: OpenCode는 --session <ID> 옵션을 통해 특정 세션ID로 대화를 저장/불러오기 할 수 있고, /share 명령으로 현재 대화를 링크 형태로 내보내 팀원이 동일한 맥락을 이어볼 수 있게 한다. 이는 에이전트의 메모리를 사람 팀원과도 공유하는 기능으로, 한 사람이 시작한 작업을 다른 사람이 이어받을 때도 맥락 손실을 줄여준다.

오케스트레이션 아키텍처: Sisyphus 오케스트레이터는 사용자의 자연어 지시에 따라 내부적으로 작업 목록을 작성하고, 각 항목을 적합한 에이전트에게 프롬프트 형태로 전달한다. 이때 전달되는 프롬프트에는 해당 에이전트가 알아야 할 맥락(예: Oracle이 만든 설계 개요, 관련 파일 내용 등)이 포함되어 있으며, Sisyphus 자신도 대화의 “메타” 흐름을 기억하여 필요 시 에이전트 간 정보를 중계한다. 일종의 중앙 메모리 허브로서 Sisyphus가 동작하는 셈이다.

백그라운드 에이전트와 툴: OpenCode 플러그인 중에는 Background Agents라는 것이 있어, Claude Code 스타일로 에이전트를 백그라운드에서 실행하며 컨텍스트를 지속시키는 기능이 있다. Oh-My-OpenCode는 이러한 툴을 활용해 Oracle 등이 메인 스레드 외부에서 검색이나 사고를 진행하고 결과만 요약해 공유하도록 하는 등, 비동기 메모리 보조를 한다. 또한 Letta 에이전트에서 영감을 받은 Agent Memory 플러그인을 통해, 에이전트 스스로 관리하는 메모리 블록을 사용할 수도 있다. 이를 적용하면 OpenCode 에이전트들이 VS Code의 /memories 디렉토리에 파일을 읽고 쓰는 memory 툴을 얻어, 장기 정보를 직접 검색하거나 수정하는 형태로 메모리를 운용할 수 있다.

토큰/모델 최적화: 멀티에이전트 환경에서는 여러 모델을 병렬로 쓰기 때문에 토큰 사용량이 급증할 수 있다. Oh-My-OpenCode는 각 에이전트에 다른 LLM을 배정하여 비용 대비 효율을 최적화한다. 예를 들어 가벼운 코드 탐색에는 무료 GLM 모델을 쓰고, 중요한 설계 판단에는 Claude 4.5와 같은 거대 모델을 투입한다. 이렇게 함으로써 큰 맥락(메모리)이 필요한 부분에만 대용량 컨텍스트 모델을 쓰고, 나머지는 소용량 모델로 분담하여 전체적인 메모리 활용을 조절한다. 또한 구현 담당 에이전트에는 주어진 파일 단위로만 작업하게 하여 불필요한 전역 컨텍스트 부담을 줄이는 등, 사람이 프로젝트를 나눠 담당하듯 맥락 범위를 분할하여 메모리를 관리한다.

세 시스템 메모리 구조 비교
측면	OpenClaw	Claude Code	Oh-My-OpenCode
장기 메모리 도입 배경 <br/>(Why needed?)	- 항상 실행되는 자율 에이전트이므로, 세션이 달라도 사용자와의 과거 상호작용과 실행 이력을 기억해야 함. <br/> - 기본 LLM의 컨텍스트만으로는 어제 한 일을 오늘 이어서 할 수 없기에 보완 필요.	- 코딩 파트너로서 프로젝트 단위의 연속성을 유지하기 위해 도입. <br/> - 긴 개발 작업에서 이전에 논의된 설계, 버그 수정 내역, 스타일 가이드를 잊지 않도록 하여 생산성 향상.	- 멀티에이전트 협업에서 에이전트들 간 공유 맥락 필수. <br/> - 대규모 프로젝트 진행 중에도 일관된 플랜을 유지하고 작업 분담 간 정보 손실을 막기 위해. <br/> - (OpenCode 기본 세션 메모리가 있었지만 복잡한 작업엔 불충분하여 확장).
메모리 저장 구조 <br/>(What is stored?)	- 파일 기반 이력: 날짜별 대화/결정 로그 파일 + 한 파일에 모은 장기 MEMORY.md. <br/> - 인간 가독성: 모든 기억을 Markdown 텍스트로 저장 (편집/버전관리 용이). <br/> - 검색 가능 아카이브: (옵션) 세션별 전문 기록 보관으로 수주일 전 내용도 추후 질의 검색 가능.	- 계층적 메모리 파일: CLAUDE.md 파일들을 사용자/프로젝트/조직별로 유지, 규칙과 정보를 계층화하여 저장. <br/> - 자동 노트: 프로젝트 폴더 내 memory/ 디렉토리에 Claude가 작성하는 MEMORY.md 및 토픽별 Markdown 메모. <br/> - 컨텍스트 내 히스토리: 모델의 긴 컨텍스트 창 안에 최근 작업 내용과 요약이 함께 존재 (필요시 자동 요약/압축).	- 프로젝트 규칙 파일: AGENTS.md에 글로벌→프로젝트→폴더 레벨의 문맥/규칙 기술, Git으로 공유 가능. <br/> - 세션 히스토리: 터미널 세션 간 지속되는 대화/작업 내역, --continue로 이어 사용 또는 /compact로 요약 저장. <br/> - 공동 할일/상태: 오케스트레이터가 관리하는 to-do 리스트와 완료 상태 (전체 에이전트가 참고하는 공유 메모). <br/> - 에이전트 산출물: 코드 구조도, 검색 결과, 결정 사항 등이 필요 시 전체 팀에 전파되어 지식 공유.
구현 기술 및 방식 <br/>(How implemented?)	- 로컬 Markdown 파일을 직접 관리: 하루/메모리 파일을 자동 로드하여 세션 시작 프롬프트 구성. <br/> - 혼합 검색: 임베딩 코사인 유사도 + BM25 키워드 가중치 병합 랭킹으로 관련 메모리 조각들을 찾아 프롬프트에 삽입. <br/> - SQLite 인덱스: 메모리 청크 임베딩과 FTS5 색인을 SQLite DB로 관리 (로컬 llama.cpp↑, OpenAI↓ 백업). <br/> - 자동 컨텍스트 flush: 컨텍스트 한계 도달 전에 모델에게 중요 정보를 파일에 기록시키는 프롬프트 삽입. <br/> - 플러그인 확장: 클라우드 벡터DB나 그래프DB로 메모리 저장 전환, 외부 Mem0 API 연동 등 모듈형 확장 가능.	- 대용량 컨텍스트 활용: 모든 메모리 파일 내용을 (요약본 형태로라도) 모델 입력에 직접 투입. LLM이 이 중 필요한 부분에 주목하도록 설계. <br/> - compaction: 대화가 길어지면 자동 요약하여 컨텍스트 리프레시, 이어서 진행. 오래된 툴 출력 등은 맥락편집으로 제거해 토큰 확보. <br/> - 파일 툴 사용: glob, open, grep 등의 도구로 필요한 코드 조각만 실시간 불러와 참조. <br/> - Memory.md 자동작성: 모델이 중요 패턴을 인지하면 MEMORY.md나 토픽 파일에 저장 (세션 중 파일쓰기). 시작 시 그 요약 일부만 로드하고 자세한 내용은 필요시 재조회. <br/> - 사용자 조정 가능: 메모리 파일을 분할(rules/*.md), 임포트(@include), 편집(/memory)할 수 있어 사람 주도 관리도 병행.	- 계층 파일 로드: OpenCode 실행 시 글로벌~폴더 AGENTS.md 모두 읽어 규칙 병합 후 프롬프트 반영. <br/> - Sisyphus 오케스트레이션: 사용자 요청→할일 목록 생성→전문 에이전트에게 개별 프롬프트 전달→결과 취합. 이 과정에서 Sisyphus가 각 단계 맥락을 기억/전달하여 중앙 메모리 역할. <br/> - 세션 이어달리기: --continue로 이전 세션 컨텍스트 유지, 아니면 /compact로 압축 후 새 세션 시작. 세션ID로 여러 작업 병행 및 이후 공유 가능. <br/> - 다중 모델 구성: 에이전트별로 적합한 LLM (대형 vs 경량)을 사용하여 컨텍스트 예산 최적화. 설계/종합에는 긴 맥락 모델 할당, 코딩/검색에는 짧은 맥락 모델로 분업. <br/> - 메모리 플러그인 활용: 필요시 agent-memory 등 플러그인으로 VS Code 내 가상 디스크에 기억 저장/검색하는 툴 사용.

각 시스템의 메모리 접근 방식은 위와 같이 요약된다. 다음으로는 이러한 차별점이 현재 시점에서 의미하는 강점과 한계를 살펴본다.

현 시점 강점 및 한계

OpenClaw: 투명한 파일 기반 메모리로 사용자가 에이전트의 “기억”을 완전히 통제할 수 있다는 점이 혁신적이다. 메모리가 Markdown으로 남아 있어 필요하면 편집하거나 Git으로 버전 관리할 수도 있다. 또한 벡터+키워드 결합으로 정확한 상기(에러코드, ID 등)와 유사 의미 검색을 동시에 충족시켜 준다. 컨텍스트 압축 전에 flush로 중요한 내용을 미리 저장함으로써 장시간 작동 시 정보 유실을 최소화한 것도 장점이다. 한편, 기본 설계상 메모리가 개인 PC 로컬에 국한되기에 기기 간 연속성이나 협업 시 실시간 공유가 어려운 한계가 있다 (이를 보완하려는 클라우드 메모리 플러그인이 등장). 그리고 메모리 파일을 컨텍스트에 재로딩하는 방식이므로, 메모리 양이 매우 방대해지면 초기에 로딩 시간과 일부 토큰 점유 비용이 늘어날 수 있다. 보안 측면에서는 평문 파일에 사용자 정보를 축적하기 때문에 유출 위험에 취약하며 (예: 멀웨어가 해당 폴더를 탈취하면 모든 대화와 개인정보가 노출됨), 프롬프트 인젝션 등을 통한 메모리 악용 가능성도 지속 제기되고 있다.

Claude Code: 거대한 컨텍스트 윈도우를 활용해 사전 지식 + 대화 이력을 한꺼번에 모델에 제공함으로써, 개발자는 “이전 이야기 되풀이”를 줄이고 AI의 활용도를 높일 수 있었다. 특히 기업 환경에서 프로젝트별 CLAUDE.md와 자동학습 메모리가 결합되어 팀의 코드 스타일부터 개인 선호까지 AI가 기억하고 따르게 만든 점은 생산성에 큰 강점이다. 또한 compaction, context editing 등의 기법 도입으로 LLM의 성능이 컨텍스트 길이에 따라 저하되는 문제를 어느 정도 기술적으로 보완하였다. 그러나 파일을 통째로 컨텍스트에 싣는 접근은 메모리 파일 규모가 커질수록 모델의 회상 정확도 저하(필요한 정보 신호가 노이즈에 묻힘) 현상이 나타나며, 메모리 용량을 무리하게 늘리면 성능 저하뿐 아니라 시스템 리소스 문제(한때 120GB RAM 누수 버그 보고 등)도 발생할 수 있었다. 결국 최적 성능을 위해서는 사용자가 메모리를 잘 관리(구조화, 불필요 내용 제거 등)해야 하는 부담이 남아 있으며, 완전히 자동화된 장기 기억이라기보다는 *“대용량 컨텍스트”*에 가까운 한계가 있다. 또한 이 기능은 주로 엔터프라이즈 제품에 적용되므로 일반 사용자에게는 접근성이 낮고, 클라우드에 민감 코드와 대화내용을 저장한다는 점에서 보안 상의 숙제가 따른다.

Oh-My-OpenCode: 멀티에이전트 협업을 통해 역할을 분담해 대규모 프로젝트를 처리하고 전문성을 활용한다는 점에서 차별화된다. 메모리 면에서도 한 에이전트가 모든 걸 기억하는 대신 각자 맡은 부분만 기억하고 Sisyphus가 전체를 조율하므로 맥락 분할이 자연스럽게 이루어진다. 이는 특정 영역에서는 OpenClaw나 Claude Code보다 효율적일 수 있다 (예: UI 관련 맥락은 UI 에이전트만, DB 스키마는 백엔드 에이전트만 기억). 또한 여러 모델을 혼용하므로 비용·속도 면에서 유연성이 높고, OpenCode 생태계를 통해 GitHub, Slack 등 외부 도구와 연계한 확장 메모리 활용도 용이하다. 반면 한 프로젝트에 7명 이상의 에이전트가 각자 맥락을 가지면 전체 시스템의 상태를 사람이 파악하기 어려울 만큼 복잡해질 수 있다. 설정 파일에서 모든 에이전트의 모델·프롬프트·권한을 조율하는 작업은 러닝 커브가 있으며, 실시간으로 에이전트들이 주고받는 정보를 검증하거나 수정하기도 어렵다 (일종의 블랙박스 팀이 되어버림). 토큰 소비량도 문제인데, 여러 에이전트에게 비슷한 맥락을 중복 전달해야 하는 경우가 많아 자칫하면 비용이 기하급수적으로 늘어날 수 있다. 따라서 Oh-My-OpenCode는 강력하지만 무거운 솔루션이며, 작은/간단한 프로젝트에는 오히려 과할 수 있고 OpenCode 단일 에이전트 모드가 더 적합할 때도 있다. 궁극적으로 멀티에이전트의 장점을 살리려면 각 에이전트의 메모리를 최소 필요한 범위로 제한하고, 요약본 공유나 핵심 정보만 전파하는 최적화가 필수적이다.

향후 에이전트 메모리 구조 전망

현재 살펴본 메모리 설계들은 모두 LLM의 한계 보완을 위한 실용적 해법들이다. 향후에는 다음과 같은 발전 경로가 예상된다:

하이브리드 기억 및 구조화 지식: 벡터 임베딩 기반 검색 vs. 파일 기반 컨텍스트 투입이라는 두 접근법이 점차 융합될 것으로 보인다. 예컨대 OpenClaw처럼 벡터DB와 키워드 검색을 병행하거나, Claude Code처럼 파일 메모리에 인덱스를 입혀두되 필요할 때만 관련 부분을 추출하는 방식 등이 있다. 더 나아가 지식 그래프나 관계형 DB에 에이전트가 장기 메모리를 저장하고 질의하는 방향도 가능하다. 이는 단순 문서 조각 이상의 의미 기반 검색과 추론을 위해 필요하며, 이미 OpenClaw 커뮤니티에서도 그래프형 메모리 확장이 나와 있다.

에이전트의 자기 메모리 관리: 사람처럼 에이전트가 스스로 무엇을 기억하고 잊을지 결정하는 기술이 발전할 것이다. 현재 Mem0 플러그인의 Auto-Capture는 대화에서 새로운 사실을 자동 추출·병합하는 수준이지만, 향후에는 모델이 자기 성찰을 통해 “지난주 실패한 접근은 장기기억에 남겨 교훈으로 삼자”거나 “이 정보는 이제 쓸모없으니 지우자”라는 판단까지 할 수 있을 전망이다. 이를 위해 self-editing memory 연구가 진행 중이며, Letta 에이전트의 메모리 블록 개념처럼 LLM이 자기 메모리 블록을 직접 업데이트하고 관리하는 구조가 실험되고 있다. 이런 능력이 갖춰지면 에이전트의 메모리는 더 이상 단순 로그가 아니라 경험을 통해 재구조화되는 지식 저장소에 가까워질 것이다.

멀티모달 기억과 맥락: 텍스트뿐 아니라 이미지, 음성, 로그 데이터까지 아우르는 기억 구조가 필요해질 전망이다. 예를 들어 향후 코드 에이전트는 UI 스크린샷이나 아키텍처 다이어그램도 기억하고 참고해야 할 수 있고, 로봇 에이전트라면 지도 정보나 과거 센서 데이터를 축적해 둘 수 있다. 이를 위해 벡터 임베딩 + 메타데이터 등을 활용하여 다양한 형식의 데이터를 통합 관리하는 멀티모달 메모리 모듈이 연구될 것이다. 또한 시계열 데이터나 “에피소드” 단위로 묶인 기억을 다루는 기술 (예: 강화학습과 연계한 episodic memory)도 발전하여, 시간에 따라 중요도가 감소하는 정보는 자동으로 압축하거나 아카이브하는 등 망각 메커니즘까지 모방할 가능성이 있다.

전담 메모리 에이전트/모델: 현재는 하나의 LLM이 모든 작업과 메모리를 겸하지만, 앞으로는 주 에이전트 외에 전담 메모리 관리자 에이전트를 두는 아키텍처가 등장할 수 있다. 이 메모리 에이전트는 대화 요약, 지식베이스 질의, 메모리 갱신 등만 전문으로 수행하고 주된 작업 에이전트에게 필요한 정보만 제공하는 식이다. Anthropic이 다중 서브에이전트 구조를 언급한 것도 비슷한 맥락으로, 복잡한 문제에서는 검색 전문 에이전트, 요약 전문 에이전트가 협업하면 성능이 향상되었다고 보고되었다. 더 나아가 메모리 전용 소형 LLM을 두어 대형 주모델의 지시를 받아 지식을 축적/조회하는 메모리 모듈화도 고려된다. 이는 컴퓨터에서 RAM과 디스크가 분리된 것에 비유할 수 있는데, 작은 모델(디스크 역할)에 장기 지식을 저장해두고 큰 모델(프로세서 역할)은 필요 시 질의만 하는 구조다.

AI 메모리의 인간 협업과 피드백: 궁극적으로 어떤 정보를 기억할지에 대한 판단에는 사용자 피드백이 중요해질 것이다. 예를 들어 사용자가 “이 부분은 중요하니 잊지 마”라고 표시하면 에이전트가 해당 사실을 영구 보존하고, “이건 틀린 정보니 잊어도 돼” 하면 적극적으로 지우거나 무시하는 식이다. 현재 Claude Code 등에서도 사용자가 CLAUDE.md를 편집하며 메모리를 관리하지만, 미래에는 더 직관적인 UI로 사람이 에이전트 기억을 직접 수정하고 신뢰성을 검증할 수 있을 것이다. 또한 여러 에이전트가 서로의 메모리를 공유하며 학습하는 연합 학습적 메모리 (팀의 에이전트들이 공동의 지식베이스를 형성)도 기업 현장에서 요구될 수 있다. 이때 프라이버시와 보안은 큰 도전으로, 중요 메모리는 암호화 저장하거나 접근 권한 계층을 두는 등 기술이 병행 발전해야 할 것이다.

요약하면, 에이전트의 장기 메모리는 앞으로 더욱 구조화되고 지능적으로 진화할 것으로 보인다. OpenClaw가 보여준 파일 기반 투명 메모리, Claude Code의 대용량 컨텍스트 및 자동 메모리, Oh-My-OpenCode의 협업 메모리 등 각 접근은 장단점이 있지만, 모두 더 나은 지속적 기억을 향한 노력의 산물이다. 향후에는 이들 아이디어가 결합되어, 에이전트가 인간처럼 과거를 학습 자산으로 삼아 창의적 문제해결 능력을 누적해나가는 모습이 기대된다. 물론 그러려면 메모리 관리의 복잡성, 데이터 보안, 윤리적 이슈까지 함께 해결해야 하는 과제가 따르겠지만, 이는 에이전트 기술이 성숙해가는 과정에서 마주할 필연적인 도전이라 할 수 있다.

ChatGPT의 말:
Read it. This is already a solid comparative draft, and (more importantly) it contains enough concrete design details to turn into an implementable framework.
What I’ll do below:

extract the latent design axes your write-up implies (so we can reason generically, not per-product)
define a unified reference architecture for “persist almost everything, but keep active context small”
point out gaps / risks that aren’t fully addressed yet
propose a next-step spec outline you can immediately implement (filesystem-first, TS-friendly)
1) What your report already establishes (the real core)
Across OpenClaw / Claude Code / Oh-My-OpenCode, three truths show up:
A. “Persistence” and “Active context” are different systems
Persistence: append-only logs + durable stores (files, db, index).
Active context: per-call curated view, assembled by policy.
Claude Code leans toward brute-force persistence → large context.
OpenClaw leans toward persistent stores → retrieval → context injection.
Oh-My-OpenCode leans toward work partitioning → each agent keeps less → orchestrator bridges.
B. Memory isn’t one thing; it’s at least 4 types
Your report implicitly covers:
Episodic (raw logs / transcripts)
Semantic (summaries, concepts, learned notes)
Procedural (rules: CLAUDE.md / AGENTS.md)
Operational state (todo, progress, decisions)
The “active context” problem is mostly about composing these types under budget.
C. The real differentiator is the “context assembly policy”
OpenClaw: scored retrieval (vector+BM25), flush-before-compaction
Claude Code: hierarchical instruction files + compaction + context editing
Oh-My-OpenCode: orchestrator-mediated sharing + role scoping + model tiering
So the competition isn’t “who stores more,” it’s “who assembles better.”
2) A clean unifying model: 3 layers + 1 orchestrator
Layer 1 — Ground Truth Store (append-only, auditable)
Everything is stored here: dialogue, tool calls, outputs, decisions.
Format: files (md/jsonl) or event log.
This is never directly shoved into prompts.
Layer 2 — Index & Projections (for retrieval, not truth)
Derived views:
embeddings
BM25/FTS
topic clusters
decision ledger
summaries (multi-level)
These can be regenerated.
Layer 3 — Canonical “Memory Views” (human-editable)
This is where OpenClaw / Claude / OpenCode all converge conceptually:
Rules (project/user/org)
Stable facts (preferences, constraints)
Living docs (architecture notes, conventions)
This is where humans can intervene.
The Context Orchestrator (per-call)
Input:
current user msg
current task state
budget
risk mode (private/public channel, sensitive, etc.)
Output:
an “active context bundle” with strict token budgets
This orchestrator is the product.
3) What’s missing / under-specified in the write-up (important)
Gap 1 — “Persist almost everything” needs a retention + privacy model
If you store near-total dialogue, you need explicit policies:
per-channel memory load rules (you already mention OpenClaw private/public split)
redaction / encryption boundaries
“never store” classes (secrets, tokens, credentials, PII)
provenance (why something is in memory)
Without this, “memory” becomes a liability.
Gap 2 — Summary drift and compaction error accumulation
Claude-style compaction and any hierarchical summaries will drift over weeks.
You need:
grounding links from summary → source events
periodic re-summarization from ground truth
conflict detection (“summary says X, logs say Y”)
Gap 3 — Multi-agent sharing needs anti-duplication and canonicalization
Oh-My-OpenCode style sharing easily duplicates context across agents.
You need:
shared artifacts, not shared chat blobs
standardized “handoff packet” format (problem, constraints, decisions, open questions, refs)
dedupe by content hash / semantic signature
Gap 4 — Evaluation metrics are missing
You can’t improve “active context curation” without measuring:
retrieval precision/recall on tasks
long-horizon coherence
decision-consistency
token cost per resolved task
“regret rate” (how often missing memory caused wrong action)
4) Proposed “Active Context Bundle” format (practical and strict)
A good default bundle for each LLM call:
Identity / rules header (fixed small; 200–500 tokens)
stable behavior + safety + project conventions
loaded from CLAUDE.md / AGENTS.md / MEMORY.md equivalents
Task state (structured; 200–400 tokens)
current goal
current plan step
constraints
open decisions
Decision ledger excerpts (structured; 200–600 tokens)
past key decisions relevant to the current intent
not free-form summary text: use a schema
Retrieved evidence (bounded; 600–1500 tokens)
top-K chunks from episodic store (raw-ish excerpts)
tool outputs if relevant
must include citations/refs (file path + offset)
Recent window (optional; 300–800 tokens)
last N turns, but only if they are directly relevant
This maps cleanly to your “active context is curated context via heuristics.”
5) The decision-ledger schema (this is the biggest upgrade)
Your report already values “결정 맥락”. Make it first-class.
Minimal schema:

id
timestamp
scope (project / user / global)
decision
rationale
constraints
alternatives_considered
consequences
references (event ids / file offsets)
confidence
status (active / superseded)
This single structure fixes:
long-term coherence
compaction drift
multi-agent handoffs
traceability
OpenClaw “flush” becomes: write decisions here before compaction.
6) Next step (no implementation yet): spec you should write
If you want this to become a real system design document, the next spec sections should be:
Storage primitives
event log format (jsonl recommended)
file layout
rotation strategy
Projections
embedding chunking policy
keyword index policy
summary hierarchy policy
decision ledger policy
Context Orchestrator
inputs/outputs
budget allocator
retrieval scoring function (OpenClaw hybrid + recency + importance)
risk-mode rules (private/public, sensitive)
Multi-agent handoff
packet format
shared artifact store
conflict / dedupe rules
Safety & privacy
redaction rules
encryption boundaries
“never store” / “store but don’t load” policies
Evaluation
task suite
metrics
regression checks
7) Concrete improvement to your comparison (if you revise the document)
Your table is good, but add one more row that matters most:
“Active Context Assembly Strategy”

OpenClaw: retrieval + flush + selective load
Claude Code: large context + compaction + context editing
Oh-My-OpenCode: role-scoped contexts + orchestrator handoff + model tiering
That row makes the whole comparison click.
If you want, next message I can produce a formal spec v1 in your preferred style (filesystem-first, TS, MCP/tool-call friendly) using the architecture above—without jumping into implementation code.

나의 말:
yes i want formal spec. and scenario it through all our design principal and used for test which is scenario based test. I will try to scenario driven validation in this project  to test agentic developement keel align final goal

ChatGPT의 말:
Below is a formal spec v1 for an AI agent memory system that (a) persists almost all dialogue/events, (b) keeps active LLM context small via curation, and (c) is validated primarily through scenario-driven tests aligned to design principles.
I’m optimizing for: low complexity, filesystem-first, TypeScript-friendly, minimal dependencies, MCP/tool-call compatibility.

Memory System Spec v1 (Scenario-Driven)
0. Scope
0.1 In scope
Persist: near-total interactions (human↔agent, agent↔agent), tool I/O, decisions, artifacts.
Active context: per-call curated bundle under strict token budget.
Scenario-driven validation harness.
Filesystem-first storage, human-readable where feasible.
0.2 Out of scope (v1)
Full UI
Distributed consensus / multi-host replication
Training / finetuning
Real-time vector DB dependency (allowed as optional plugin later)
1. Design Principles (Normative)
P1. Ground truth is append-only. Never rewrite primary logs.
P2. Derived views are disposable. Indexes/summaries can be regenerated.
P3. Active context is a product. Context assembly is explicit, testable, budgeted.
P4. Traceability by reference. Any summary/decision must cite source event IDs.
P5. Least-privilege memory loading. Public/private separation; sensitive data not loaded by default.
P6. Human-legible override. Key memory views are readable/editable (markdown/yaml/json).
P7. Determinism where possible. Memory selection policy should be reproducible given inputs.
P8. Scenario-driven validation. Every feature exists to satisfy a scenario + measurable outcomes.
2. Terminology
Event Log (Ground Truth): Append-only record of everything.
Projection: Derived index/view (embeddings, BM25, summaries, decision ledger).
Memory View: Curated human-readable knowledge (rules, preferences, conventions).
Active Context Bundle (ACB): The per-call prompt payload assembled under a budget.
Scenario Test: Scripted interaction + expected memory outcomes.
3. Architecture Overview
3.1 Components
Recorder: writes events to ground truth log
Projector(s): generate projections from events
Context Orchestrator: builds Active Context Bundle (ACB) for an LLM call
Policy Engine: rules for privacy/budgets/loading/suppression
Scenario Harness: runs scenario scripts + asserts expected behavior
3.2 Data Flow (high-level)
Receive input (user/agent/tool)
Recorder appends event(s)
Projectors update projections (sync or async mode)
Orchestrator assembles ACB for next call
LLM call happens
Output becomes new events, loop continues
4. Storage Spec (Filesystem-first)
4.1 Directory layout (normative)
memory/
  manifest.json
  policies/
    privacy.yaml
    budgets.yaml
    channels.yaml
  views/
    identity.md
    rules.project.md
    preferences.md
    glossary.md
  events/
    2026-02/
      2026-02-09.jsonl
  projections/
    bm25.sqlite         (optional)
    vectors.sqlite      (optional)
    summaries/
      session/
      episode/
    decisions.jsonl
    tasks.jsonl
  artifacts/
    attachments/
    tool_outputs/
  scenarios/
    *.scenario.yaml
  reports/
    *.report.json
Notes:
events/ is ground truth (append-only)
views/ is human-curated canonical memory
projections/ are derived; can be deleted and rebuilt
4.2 Event format (jsonl) (normative)
Each line is an event:
{
  "id": "evt_20260209_000123",
  "ts": "2026-02-09T05:12:33+09:00",
  "channel": "private|public|team|agent",
  "actor": { "type": "human|agent|tool", "id": "user|agentA|tool.shell" },
  "kind": "message|tool_call|tool_result|decision|summary|task_update|artifact",
  "content": { "...": "..." },
  "refs": ["evt_..."], 
  "tags": ["topic:memory", "project:X"],
  "sensitivity": "none|low|high|secret",
  "hash": "sha256:..."
}
Requirements:
id unique and monotonic per day file (implementation detail ok)
hash allows integrity/dedup
sensitivity must be set for secrets/PII detection pipelines (even if simple heuristics in v1)
5. Memory Views (Human-controlled)
5.1 Mandatory views
views/identity.md: agent identity, tone constraints, stable behavior
views/rules.project.md: project conventions (coding style, architecture)
views/preferences.md: user preferences (if allowed to store)
views/glossary.md: canonical terms & abbreviations
5.2 Loading rules
Views are always candidates for ACB, but each has budget caps.
Privacy policy may suppress loading of certain views in public channels.
6. Projections (Derived)
6.1 Decision Ledger (mandatory)
Stored as projections/decisions.jsonl.
Schema (normative):

{
  "id": "dec_000045",
  "ts": "2026-02-09T05:30:00+09:00",
  "scope": "project|user|global",
  "decision": "Use event-sourced memory as ground truth",
  "rationale": ["auditability", "rebuildable projections"],
  "constraints": ["filesystem-first", "TypeScript"],
  "alternatives": ["pure summarization", "only vector DB"],
  "consequences": ["append-only growth", "need compaction in projections"],
  "refs": ["evt_20260209_000120", "evt_20260209_000121"],
  "status": "active|superseded",
  "confidence": 0.74
}
Rules:
Every decision must cite source events via refs.
Superseding a decision must reference previous decision ID.
6.2 Task State (mandatory if agentic dev)
projections/tasks.jsonl tracks goals, todos, status, owners.
6.3 Retrieval index (optional in v1)
BM25/FTS index: optional sqlite
Vector index: optional sqlite
If absent, retrieval falls back to:
recency window + keyword scan (low dependency baseline)
6.4 Summaries (optional but recommended)
Hierarchical summaries stored in:
projections/summaries/session/*
projections/summaries/episode/*
All summary artifacts must include:
refs to source events
scope and coverage metadata
7. Active Context Bundle (ACB) Spec
7.1 ACB structure (normative)
The orchestrator outputs:
{
  "acb_id": "acb_20260209_0009",
  "ts": "...",
  "budget_tokens": 6000,
  "sections": [
    { "name": "identity", "items": [ ... ], "token_est": 450 },
    { "name": "task_state", "items": [ ... ], "token_est": 350 },
    { "name": "relevant_decisions", "items": [ ... ], "token_est": 600 },
    { "name": "retrieved_evidence", "items": [ ... ], "token_est": 1800 },
    { "name": "recent_window", "items": [ ... ], "token_est": 900 }
  ],
  "omissions": [
    { "reason": "budget", "candidates": ["evt_..."] },
    { "reason": "privacy", "candidates": ["views/preferences.md#..."] }
  ],
  "provenance": {
    "policy_version": "pol_0003",
    "retrieval_queries": ["..."],
    "scoring": { "alpha": 0.6, "beta": 0.3, "gamma": 0.1 }
  }
}
7.2 Budget allocation (policy-driven)
Budgets are set in policies/budgets.yaml, example:
identity: max 500 tokens
task_state: max 400
decisions: max 800
evidence: max 2500
recent: max 1200
Hard caps. Orchestrator must not exceed.
7.3 Selection algorithm (normative baseline)
A chunk candidate gets a score:
score = α * similarity + β * recency + γ * importance

Where:

similarity: semantic (if embeddings) else keyword overlap
recency: exponential decay
importance: derived from tags, decision/task refs, user pinning
Then:
Fill sections in priority order (identity → task → decisions → evidence → recent)
Enforce privacy suppression before scoring
Record omissions
8. Privacy & Safety Policies
8.1 Storage policy
By default, record everything except secrets classified as secret must be redacted or stored encrypted (v1 can implement “don’t store secrets” to keep complexity low).
Provide policies/privacy.yaml:
what is suppressed in public channels
what is never loaded
what is never stored (preferred for v1)
8.2 Loading policy
Public channel: do not load preferences.md or any high/secret.
Agent↔agent: load only project rules + decisions relevant to assigned task.
9. Scenario-Driven Validation Spec
9.1 Scenario file format (normative)
scenarios/*.scenario.yaml
id: SCN-001
title: "Long dialog persistence with small active context"
principles: [P1, P3, P4, P8]
budget_tokens: 4000
initial_views:
  - views/identity.md
  - views/rules.project.md

steps:
  - actor: human
    kind: message
    content: "We decided to use filesystem-first memory and avoid external DB."
  - actor: agent
    kind: decision
    expect_store_decision: true
  - actor: human
    kind: message
    content: "In a public channel, do not reveal my preferences."
  - actor: agent
    kind: message
    content: "Acknowledged."

assertions:
  - type: event_exists
    where: { kind: "decision", contains: "filesystem-first" }
  - type: acb_max_tokens
    max: 4000
  - type: acb_section_not_contains
    section: "identity"
    contains: "user preferences"
  - type: traceability
    target: "decision"
    must_have_refs: true
9.2 Scenario execution model
For each step:
inject event(s) to recorder
run projectors (as configured)
run orchestrator to produce ACB
evaluate assertions at that point
9.3 Minimum scenario suite (v1)
You should have at least these 10:
SCN-001 Long dialog persists; ACB stays under budget
SCN-002 Compaction/summarization does not break traceability
SCN-003 Public/private channel loading suppression works
SCN-004 Decision supersedes earlier decision; latest is selected
SCN-005 Retrieval finds old but relevant decision from weeks ago
SCN-006 Multi-agent handoff: orchestrator shares only handoff packet
SCN-007 Duplicate info appears in logs; dedupe prevents prompt bloat
SCN-008 Tool output is huge; context editing keeps only needed excerpt
SCN-009 Wrong summary detected vs events; conflict flagged
SCN-010 “Pinned” memory always included despite low similarity
Each scenario explicitly maps to principles and measurable assertions.
10. Multi-Agent Handoff Packet (Normative)
To prevent chat-blob sharing, define:
{
  "handoff_id": "hof_0012",
  "to_agent": "Implementer",
  "task": "Refactor memory layout",
  "constraints": ["filesystem-first", "no external deps"],
  "decisions": ["dec_000045", "dec_000050"],
  "required_files": ["memory/manifest.json", "policies/budgets.yaml"],
  "open_questions": ["Do we store secrets at all in v1?"],
  "refs": ["evt_...", "dec_..."]
}
Only this packet is injected into the receiving agent’s ACB, not the full history.
11. Non-Functional Requirements
NFR1: ACB assembly must complete within a target time budget (set later).
NFR2: Rebuild projections from events must be possible.
NFR3: Human can inspect/override memory views easily.
NFR4: Minimal dependencies baseline (no vector DB required).
NFR5: Deterministic orchestration given same inputs + same indexes.
12. Acceptance Criteria (v1)
System is v1-complete when:
Event log and decision ledger work end-to-end
Orchestrator generates ACB with strict budgets + provenance
Privacy suppression is enforced in scenarios
Scenario harness runs the minimum scenario suite and produces reports
Projections are rebuildable (delete projections/, rebuild from events/)
Next step
Tell me your preferred initial token budget target for ACB (e.g., 4k / 8k / 16k). If you don’t choose, we’ll default to 8k and derive budgets.yaml accordingly.
Then I’ll write Spec v1.1 with:

exact policy file schemas (privacy.yaml, budgets.yaml, channels.yaml)
scenario assertion DSL details
deterministic scoring + tie-break rules
minimal baseline retrieval (no embeddings) + optional plugin hooks

나의 말:
initial token budget is 65K.  and i have one more non-functional requirement. it is active context curation speed must as quick as possible.

ChatGPT의 말:
Understood: ACB budget = 65K tokens, and you add a key NFR: active context curation must be as fast as possible.
Below is Spec v1.1 updates: (1) budgets at 65K, (2) explicit performance requirements + architecture choices to minimize latency, (3) concrete policy file schemas and deterministic selection rules that remain fast.

Memory System Spec v1.1 (65K ACB + Fast Curation)
1) Update: Active Context Budget Policy (65K)
1.1 Budget philosophy
Even with 65K, you still need strict allocation to prevent “context bloat” and preserve signal. The goal is not “use all 65K,” but “never exceed 65K, and usually use much less unless needed.”
1.2 policies/budgets.yaml (normative schema + example)
Schema:
acb_total_max_tokens: integer
sections: map of section → {max_tokens, priority}
reserve_tokens: headroom for user message/tool inserts
Example for 65K:
version: 1
acb_total_max_tokens: 65000
reserve_tokens: 5000   # always keep headroom for user/tool payloads

sections:
  identity:
    max_tokens: 1200
    priority: 10
  rules:
    max_tokens: 6000
    priority: 9
  task_state:
    max_tokens: 3000
    priority: 9
  relevant_decisions:
    max_tokens: 8000
    priority: 8
  retrieved_evidence:
    max_tokens: 28000
    priority: 7
  recent_window:
    max_tokens: 12000
    priority: 6
  tool_state:
    max_tokens: 2000
    priority: 6
Notes:
Evidence gets the largest share because it’s the only section that really benefits from scale.
Identity stays small by design (stability + speed).
2) New NFR: Active Context Curation Speed (Critical)
2.1 Performance NFRs (normative)
NFR-S1. Fast-path assembly: For typical turns, ACB must assemble using only:
last-N events
cached projections
O(1) file reads of small views
(no full-history scans)
NFR-S2. P95 latency target (local workstation baseline):
≤ 150ms for fast-path assembly (no embeddings query)
≤ 500ms when doing retrieval (BM25 and/or vectors)
≤ 1500ms worst-case fallback (cold cache, large evidence retrieval)
(Exact numbers can be adjusted later, but you need explicit targets to guide design.)
NFR-S3. Deterministic and bounded:

Every step must have hard limits: max candidates scanned, max chunks retrieved, max bytes read.
NFR-S4. Incremental updates:
Projectors update indices incrementally per event append; no batch rebuild during normal operation.
2.2 Architectural consequences for speed
A) Separate “event recording” from “projection updates”
Recorder is synchronous (append-only write).
Projectors are incremental and can be async, but must keep a small “hot index” up to date.
B) “Hot set” cache (mandatory)
Maintain a memory-hotset in projections/hotset.json (or in-memory if daemon):
Hot set includes:

last N turns (e.g., last 200 events)
latest active tasks
active decisions
top topics for current session
The orchestrator assembles most ACBs from the hot set + small views without touching large stores.
C) Two-stage retrieval for speed (mandatory)
Cheap candidate generation
keyword / tag / recency filters
limit to a bounded candidate pool (e.g., 2k chunks)
Expensive re-ranking
only applied to the candidate pool (BM25/embedding score)
This avoids slow “search everything.”
D) Precomputed token estimates (mandatory)
Every stored chunk/summary/decision should have:
token_est computed at write time (or projector time)
Then orchestration becomes arithmetic, not repeated tokenization.
3) Deterministic, Fast Context Assembly Rules (v1.1)
3.1 Orchestrator algorithm (normative)
Inputs:
intent (cheap classifier: rule-based + small prompt optional)
channel (public/private/team/agent)
budget.yaml
hotset
indices (optional)
Procedure:
Load mandatory small views: identity, rules, task_state (bounded file reads)
Apply privacy suppression (drop blocked views/chunks before scoring)
Add “active decisions” from decision ledger (bounded top-M, e.g., 100)
Candidate retrieval:
If intent requires deep recall → run retrieval
Else skip retrieval, rely on hotset + recent_window
Add evidence chunks until section caps reached
Add recent_window until cap reached
Emit ACB + provenance + omissions
3.2 Tie-break rules (deterministic)
When scores tie:
prefer higher importance
prefer more recent
prefer smaller token_est (pack more items)
stable sort by id
This avoids nondeterministic “random” ACBs.
4) Policy Schemas (explicit)
4.1 policies/privacy.yaml (schema + example)
version: 1

store:
  never_store_kinds:
    - secret
  redact_patterns:
    - "(?i)api_key\\s*[:=]\\s*\\S+"
    - "(?i)password\\s*[:=]\\s*\\S+"

load:
  channel_rules:
    public:
      suppress_sensitivity: [high, secret]
      suppress_views:
        - views/preferences.md
    private:
      suppress_sensitivity: [secret]
    agent:
      suppress_sensitivity: [high, secret]
v1 recommendation for speed + simplicity: “never_store secrets” rather than encrypting.
4.2 policies/channels.yaml
version: 1
channels:
  - name: private
    default_load_views: [views/identity.md, views/rules.project.md, views/preferences.md]
  - name: public
    default_load_views: [views/identity.md, views/rules.project.md]
  - name: agent
    default_load_views: [views/identity.md, views/rules.project.md]
5) Scenario-Driven Validation updates (65K + speed)
5.1 Add performance assertions to scenario DSL
New assertion types:
acb_build_latency_p95_ms: <int>
acb_candidate_scan_max: <int>
acb_file_reads_max: <int>
acb_bytes_read_max: <int>
Example:
assertions:
  - type: acb_max_tokens
    max: 65000
  - type: acb_build_latency_p95_ms
    max: 500
  - type: acb_candidate_scan_max
    max: 2000
  - type: traceability
    target: "decision"
    must_have_refs: true
5.2 Minimum performance scenarios (add 3)
SCN-P1 Fast path: no retrieval, hotset only, verify latency and file read counts
SCN-P2 Retrieval path: intent requires deep recall, verify candidate bounds + latency
SCN-P3 Cold cache: delete hotset/projections, rebuild minimal, verify worst-case stays bounded
6) Acceptance Criteria additions (speed)
Add to v1 acceptance:
P95 ACB assembly meets target under:
fast path
retrieval path
cold cache path
Orchestrator emits instrumentation in reports/*.report.json:
timing breakdown
candidate pool size
sections packed
bytes read
This is needed to iterate toward “as quick as possible” without guessing.
7) Practical speed defaults (recommended)
These are “knobs” you’ll tune, but define them now:
hotset max events: 200
candidate pool max: 2000 chunks
retrieved chunks max: 200
per-chunk max tokens: 400–800 (chunk size)
per-call file reads max: 20
per-call bytes read max: e.g., 2–8 MB (tunable)
Next output I can generate immediately
If you want to proceed, the next deliverable should be Spec v1.2: “Exact file formats + scenario suite skeleton”, including:
exact JSON schemas for hotset, acb, report
scenario templates for SCN-001..010 + SCN-P1..P3
deterministic scoring function definition (including recency decay function)
minimal baseline retrieval (keyword/tag/recency) that requires no sqlite at all
If you have a preference: do you want the baseline retrieval index to be (A) zero-dependency file scan, or (B) sqlite FTS5 as the first optional dependency?

나의 말:
A. zero dependency. but keep architecture not to slow

ChatGPT의 말:
Got it: A) zero-dependency baseline, but architecture must stay fast.
Below is Spec v1.2 focused on: (1) fast context curation without sqlite/vector DB, (2) exact file formats for hotset/ACB/report, (3) deterministic retrieval/scoring with bounded work, (4) scenario suite skeleton including performance scenarios.

Memory System Spec v1.2 (Zero-Dependency + Fast)
1) Zero-Dependency Retrieval Without Being Slow
1.1 Core strategy
We avoid full-history scans by introducing bounded, incremental “micro-indexes” stored as plain JSON files (small, append/update), generated from events.
Key idea:

Ground truth is big.
Retrieval operates on small, precomputed catalogs.
1.2 Mandatory micro-indexes (all JSON, small)
Stored under projections/micro/:
chunk_catalog.jsonl
One line per chunk (chunk = excerpt from an event or summary)
Contains minimal metadata + cheap lexical fingerprints
term_postings/ (sharded JSON)
A tiny inverted index: term → list of chunk IDs
Sharded by prefix to keep files small
recency_ring.json
Ring buffer of last N chunk IDs (fast recency candidates)
topic_heads.json
A small list of top active topics + their chunk IDs
This stays “zero dependency” but prevents slow scans.
2) Exact File Formats
2.1 Chunk Catalog (projections/micro/chunk_catalog.jsonl)
Each line:
{
  "chunk_id": "chk_20260209_000123_01",
  "source_evt": "evt_20260209_000123",
  "ts": "2026-02-09T05:12:33+09:00",
  "channel": "private",
  "kind": "message|tool_result|decision|summary|artifact",
  "sensitivity": "none|low|high|secret",
  "tags": ["topic:memory", "proj:X"],
  "token_est": 180,
  "text_head": "First 160 chars for debugging",
  "lex":
  {
    "terms": ["memory","context","budget","flush"],
    "bloom": "base64:...",        // optional in v1, can omit
    "simhash16": "3f7a..."        // optional cheap similarity
  },
  "importance": 0.2
}
Rules:
terms = normalized tokens (lowercase, split on non-alnum, length>=3, stopword removed)
text_head is not for retrieval, just for debugging/reporting
token_est computed at catalog time
Why this is fast: you never open big event files to rank; you rank catalog entries.
2.2 Term Postings (Inverted Index) (projections/micro/term_postings/ab.json)
Sharded by first two letters of term. Example file me.json:
{
  "memory": ["chk_...","chk_..."],
  "merge": ["chk_..."]
}
Rules:
each posting list is capped (e.g., keep latest 5000 chunk IDs per term)
projector updates these incrementally
old IDs evicted by recency
Fast candidate gen: term lookup is O(#query_terms + postings).
2.3 Recency Ring (projections/micro/recency_ring.json)
{
  "max": 5000,
  "cursor": 1280,
  "chunk_ids": ["chk_...","chk_...", "..."]
}
Use this as the fallback candidate pool for many intents.
2.4 Hotset (projections/hotset.json)
Hotset is what makes the fast path fast:
{
  "version": 1,
  "updated_ts": "2026-02-09T05:40:00+09:00",
  "active_session": "sess_20260209_A",
  "recent_event_ids": ["evt_...","evt_..."],

  "active_tasks": ["tsk_001","tsk_002"],
  "active_decisions": ["dec_000045","dec_000050"],

  "topic_heads": [
    {"topic":"memory", "chunk_ids":["chk_...","chk_..."]},
    {"topic":"privacy", "chunk_ids":["chk_..."]}
  ],

  "pins": {
    "chunks": ["chk_pin_..."],
    "views": ["views/identity.md#v1", "views/rules.project.md#core"]
  }
}
2.5 ACB output (reports/acb_*.json) (normative)
{
  "acb_id": "acb_20260209_0009",
  "ts": "2026-02-09T05:41:12+09:00",
  "budget_tokens": 65000,
  "token_used_est": 41820,
  "sections": [
    {
      "name": "identity",
      "items": [{"type":"view_ref","ref":"views/identity.md"}],
      "token_est": 900
    },
    {
      "name": "relevant_decisions",
      "items": [{"type":"decision_ref","ref":"dec_000045"}],
      "token_est": 1200
    },
    {
      "name": "retrieved_evidence",
      "items": [{"type":"chunk_ref","ref":"chk_...","score":0.83}],
      "token_est": 21000
    }
  ],
  "omissions": [
    {"reason":"budget","candidates":["chk_..."]},
    {"reason":"privacy","candidates":["chk_..."]}
  ],
  "provenance": {
    "policy_version": "bud_v1|priv_v1",
    "intent": "design_spec",
    "query_terms": ["spec","memory","context","budget"],
    "candidate_pool_size": 1800,
    "scoring": {"alpha":0.55,"beta":0.35,"gamma":0.10},
    "deterministic_seed": "none"
  }
}
2.6 Performance report (reports/run_*.report.json)
{
  "run_id": "run_20260209_0001",
  "scenarios": [
    {
      "id": "SCN-P1",
      "p95_ms": 120,
      "max_ms": 260,
      "bytes_read": 1048576,
      "file_reads": 12,
      "candidate_pool_max": 1800
    }
  ]
}
3) Deterministic Retrieval & Scoring (Fast + Bounded)
3.1 Candidate Generation (zero-dep)
Given query terms Q:
Candidate pool = union of:

postings(term) for each term in Q (cap each list)
recency_ring tail window (e.g., last 800 chunks)
hotset topic_heads chunks (if topic matches)
pinned chunks
Then cap:
candidate_pool_max = 2000 (tunable)
If union exceeds cap:
take in priority order: pinned → hotset → postings → recency fallback
3.2 Scoring (no embeddings baseline)
We use cheap lexical + policy features:
lexical = jaccard(query_terms, chunk_terms) (approx)
recency = exp(-Δt / τ) (τ e.g. 7 days)
importance = catalog.importance + tag_boost + decision_ref_boost
Final:
score = α*lexical + β*recency + γ*importance
Tie-breaks:

higher importance
more recent
smaller token_est
chunk_id lexicographic
All deterministic.
3.3 Packing into ACB (fast)
Use precomputed token_est.
Greedy pack by score within each section cap.
4) Speed Requirements Enforced by Hard Limits
Add these to policy (defaults):
candidate_pool_max: 2000
postings_cap_per_term: 5000
recency_tail_window: 800
max_file_reads_per_call: 20
max_bytes_read_per_call: 8MB
hotset_recent_events_max: 200
The orchestrator must stop when limits hit and report omissions.
5) Projectors (Incremental, zero-dep)
5.1 On each appended event
Projector does:
derive 0..N chunks (usually 1)
compute:
token_est
terms list
importance heuristic
append to chunk_catalog.jsonl
update term_postings/<shard>.json for each term (bounded)
update recency_ring.json
update hotset.json (active lists, topics)
This is O(chunk_terms) work per event, bounded.
6) Scenario Suite Skeleton (incl. performance)
Create these files in scenarios/:
6.1 SCN-P1 Fast Path (no retrieval)
Intent: simple continuation
Expected: orchestrator uses hotset + recent window only
Assertions:
p95_ms <= 150
candidate_pool_size <= 500 (should be small)
file_reads <= 12
6.2 SCN-P2 Retrieval Path (lexical)
Intent: “recall old decision from weeks ago”
Assertions:
decision chunk included
candidate_pool_size <= 2000
p95_ms <= 500
6.3 SCN-P3 Cold Cache
Delete hotset + micro indexes
Rebuild from last 1 day only (bounded rebuild in scenario)
Assertions:
max_ms <= 1500
ACB still under 65K
traceability preserved
6.4 SCN-003 Privacy
Public channel should suppress preferences and high/secret
Assertions:
ACB excludes preferences view and sensitive chunks
6.5 SCN-004 Decision superseding
Old decision active then superseded
Assertions:
only latest active appears in ACB
7) Multi-Agent Handoff (fast + minimal)
Handoff packets are stored as:
projections/handoffs.jsonl
Orchestrator includes only:

the packet
referenced decision IDs
minimal evidence chunks (top 20)
This prevents large cross-agent context replication.
8) Acceptance Criteria (v1.2)
Passes when:
No dependency beyond filesystem + Node runtime
ACB assembled under 65K with section caps
Fast path meets latency targets
Retrieval path meets bounded candidate pool + latency targets
Scenario suite passes with generated reports/run_*.report.json
Next step (no code yet, but concrete)
To lock this spec, choose one normalization rule set for query terms (since it affects postings compatibility):
Option N1 (simplest, fastest):

lowercase
split on non-alnum
keep len≥3
stopword list of ~100 English words
no stemming
Option N2 (better recall, slightly slower):
N1 + very small stemmer (hand-rolled suffix strip: -ing, -ed, -s)
If you don’t choose, I’ll proceed with N1 (least complexity, fastest, predictable).

나의 말:
i need specifix scenario to validate memory system design also use acceptance test scenario

ChatGPT의 말:
Below are specific, concrete scenarios you can use as acceptance tests for the memory system. They are written in a way that directly validates the design principles (append-only truth, rebuildable projections, traceability, privacy, fast curation, bounded work) and your core goal: persist almost everything but keep active context curated (65K budget).
I’m giving you:

a scenario catalog (what it proves)
12 acceptance scenarios with step-by-step scripts + assertions
each scenario includes speed and budget assertions where relevant
You can implement these as scenarios/*.scenario.yaml later, but this is the exact content you need.
Acceptance Scenario Catalog
Core correctness (memory works)
A1. Persist almost all dialog + tool I/O
A2. Retrieve old but relevant info without loading whole history
A3. Decisions are first-class + traceable + supersedable
A4. Summaries never become “floating facts” (must cite events)
A5. Task state persists and stays consistent
A6. Multi-agent handoff shares artifacts, not chat blobs
Safety / governance
A7. Public/private memory loading suppression
A8. “Never store secrets” enforcement (or redaction)
Performance / boundedness
A9. Fast-path assembly (hotset only)
A10. Retrieval-path assembly bounded (candidate_pool_max)
A11. Cold-cache bounded recovery
A12. No prompt bloat from duplication (dedupe/packing)
Scenario Template (use for all)
Each scenario specifies:
Principles validated: P1..P8
Setup: initial files, policies
Steps: messages, tool outputs, decisions
Assertions: memory artifacts + ACB composition + performance + traceability
12 Specific Acceptance Scenarios
SCN-A1: “Persist almost everything” (dialog + tools) ✅
Proves: P1, P2, P4
Setup: private channel, empty memory dir
Steps:
human: “Create a memory system spec; use filesystem-first; TS.”
agent: tool_call search_files (fake tool)
tool_result: returns 200 lines of output
agent: message summary + decision “filesystem-first”
Assertions:
events/ contains all four events kinds: message/tool_call/tool_result/decision
tool_result event stored even if huge (may be chunked), but ground truth exists
decision ledger contains “filesystem-first” with refs pointing to the message event IDs
ACB for step 4 includes decision ref but not entire 200-line tool output (only excerpt)
SCN-A2: Old decision recall after 2 weeks ✅
Proves: P3, P4, “active context curated”
Setup: preload event log from “two weeks ago” containing decision D1: “Zero-dep retrieval.”
Steps:
today human: “Why did we avoid sqlite in v1?”
orchestrator builds ACB
Assertions:
ACB includes decision_ref for D1
ACB includes at least 1 evidence chunk from 2 weeks ago (by chunk_id)
ACB does not include unrelated old chat chunks
Candidate pool size ≤ 2000 (bounded)
SCN-A3: Superseding decisions selects the latest ✅
Proves: P4 traceability + deterministic selection
Setup: private channel
Steps:
human: “Decision: never store secrets (v1).”
agent: decision D1 active
human: “Update: we will store secrets but encrypted (v2).”
agent: decision D2 supersedes D1
human: “What’s the policy now?”
Assertions:
decision ledger contains D1 (status=“superseded”) and D2 (status=“active”)
ACB for step 5 includes D2 and excludes D1 (unless asked for history)
D2 has refs to step 3 event + mentions superseding D1 id
Deterministic tie-break: if both match query, latest active wins
SCN-A4: Summary drift guard (summary must cite ground truth) ✅
Proves: P2, P4, summary traceability
Setup: create a session summary file with a wrong statement (“budget is 32K”)
Steps:
human: “Our token budget is 65K.”
projector writes summary S1
later, orchestrator sees both old wrong summary and new events
human: “What’s our budget?”
Assertions:
Orchestrator must prefer decisions/events over conflicting summaries
ACB includes evidence chunk from step 1 (or decision referencing it)
A report entry conflict_flag exists: summary claims 32K but events say 65K
Summary S1 must have refs; if not, it is ignored for ACB inclusion
SCN-A5: Task continuity across sessions ✅
Proves: task projection persistence
Setup: start a task with 5 todos
Steps:
human: “Implement micro-index projectors: catalog, postings, recency_ring.”
agent: creates tasks T1..T3 (task_update events)
restart session (new day file)
human: “Continue.”
Assertions:
tasks.jsonl retains open tasks
hotset lists active tasks after restart
ACB includes task_state with remaining tasks
No need to load full dialog history to know tasks
SCN-A6: Multi-agent handoff uses packet, not transcript ✅
Proves: Oh-My-OpenCode-style memory discipline
Setup: orchestrator + agentA + agentB
Steps:
agentA works 30 turns; produces decision + file refs
orchestrator creates handoff_packet to agentB
agentB receives packet and continues
Assertions:
ACB for agentB contains only:
handoff packet
referenced decision IDs
minimal evidence chunks (≤ 20 chunks)
ACB for agentB does not include the 30-turn transcript
Traceability preserved via refs
SCN-A7: Public channel suppression ✅
Proves: P5 least privilege loading
Setup: preferences.md contains sensitive preferences; privacy.yaml says suppress in public
Steps:
private human: “I prefer X; remember it.” (stored in preferences view)
later public human: “What are my preferences?”
Assertions:
In public channel, ACB must not include preferences view contents
Agent response should refuse or say it can’t access that here
events still stored (ground truth), but load policy blocks injection
SCN-A8: Secret handling “never store” (v1) ✅
Proves: safety + policy enforcement
Setup: privacy.yaml never_store_kinds: secret + redact patterns
Steps:
human: “My API key is sk-ABCDE…”
recorder processes message
Assertions:
event stored with redaction OR not stored (depending on policy), but:
raw secret is absent from disk
event has sensitivity: secret and content redacted
ACB never includes secret content in any channel
SCN-A9: Fast path (no retrieval) ✅
Proves: speed NFR, hotset effectiveness
Setup: hotset populated, intent=continue
Steps:
human: “Continue writing scenario tests.”
orchestrator builds ACB from hotset + small views
Assertions:
file_reads ≤ 12
bytes_read ≤ 2MB
p95 ≤ 150ms (local baseline)
candidate_pool_size ≤ 500
ACB stays under budget
SCN-A10: Retrieval path bounded and fast ✅
Proves: bounded work without sqlite
Setup: postings populated with 50k chunks historically
Steps:
human: “Find the decision about ‘candidate_pool_max’.”
Assertions:
candidate_pool_size ≤ 2000
retrieved chunks ≤ configured max (e.g., 200)
p95 ≤ 500ms
ACB includes the correct decision + one supporting evidence chunk
SCN-A11: Cold-cache recovery bounded ✅
Proves: rebuildability + bounded worst-case
Setup: delete projections/micro/* and hotset.json
Steps:
human: “Why is retrieval still fast without sqlite?”
system rebuilds minimal micro-index from last 1 day (bounded rebuild)
Assertions:
rebuild completes within max_ms ≤ 1500ms (or your chosen bound)
ACB includes correct explanation via recent decision/event
system reports “partial index rebuilt” if older data not indexed yet (honest degradation)
SCN-A12: Dedupe prevents prompt bloat ✅
Proves: packing discipline
Setup: same fact appears in 20 messages (“budget is 65K”)
Steps:
human repeats the fact in different phrasing over time
later human: “What’s the budget?”
Assertions:
ACB includes at most 1–3 chunks for that fact (dedup by hash/simhash or identical refs)
token_used_est is stable (doesn’t grow linearly with repetition)
provenance records dedupe count
How to use these as “acceptance tests”
A run passes if:
all SCN-A1..A12 pass
each scenario produces a reports/run_*.report.json with metrics
failures are actionable (e.g., which assertion, which file, which ref)
Minimal Acceptance Thresholds (recommended defaults)
ACB max: 65,000 tokens (never exceed)
Fast path p95: ≤ 150ms
Retrieval p95: ≤ 500ms
Cold-cache max: ≤ 1500ms
Candidate pool max: 2000
File reads per call max: 20
Bytes read per call max: 8MB
If you want the next artifact: I can convert these 12 into actual .scenario.yaml files with a consistent DSL (assertion types, where-clauses, stable IDs) so you can directly wire a runner around them.

나의 말:
for first scenario, i guess start from legacy software project . in the project root folder. user request "what this project for?" . ai agent system to answer the question. what internal workflow between modules include our agent memory module.  imagine this workflow is help you to make realistic scenario

ChatGPT의 말:
Below is a realistic SCN-A1 (Legacy Project Onboarding) acceptance scenario, starting from a legacy repo root. I’ll describe (1) the internal workflow across modules (Recorder → Projectors → Orchestrator → Tools) including the memory module, and (2) the scenario steps + assertions that validate the memory system design.
SCN-A1: Legacy Project Onboarding (“What is this project for?”)
Goal
User opens a legacy software repository and asks:
“what this project for?”
Agent must answer with a grounded explanation, while the memory system:
persists all interactions + tool I/O
curates a 65K ACB without bloating
stays fast (hotset first, bounded retrieval)
produces traceable decisions and evidence refs
A) Internal Workflow (realistic module interaction)
Modules involved
Ingress / Router
Receives user input, assigns channel (private), sets intent=repo_onboarding.
Recorder (Ground Truth)
Appends:
user message event
each tool call event
each tool result event
final agent answer event
optional decision event (e.g., “Project purpose hypothesis v0.1”)
Context Orchestrator
Builds an initial ACB-fast using:
identity/rules views
hotset (empty at first run)
task state (creates onboarding task)
Because question needs repo evidence, it triggers Tool Plan:
minimal set of file reads (README, package manifest, entrypoint, docs)
bounded bytes read
Tool Executor (FS tools)
Runs repository introspection tools (no network):
list_root
read_file(README.md)
read_file(package.json / pyproject.toml / go.mod / Cargo.toml)
grep("main|entry|server|app", src/) (bounded)
optionally read_file(docker-compose.yml) / Makefile
Projectors (Incremental, zero-dep)
For each tool result, create chunks and update:
chunk_catalog.jsonl
term postings shards
recency ring
hotset topic head “repo_onboarding”
Optionally extract a Decision:
D1: “Project purpose: X (confidence 0.6), evidence refs: …”
Stored in decisions.jsonl
Second Orchestration (ACB-reason)
Now ACB includes:
key evidence chunks (README excerpt, package scripts, entrypoint)
not the entire file contents if huge (only relevant excerpts)
Calls LLM to draft answer with citations (refs)
Response + Memory Update
Agent responds with:
inferred purpose + supporting evidence
explicit uncertainty if evidence weak
Recorder stores final message event
Hotset updated so next question is fast (“How to run it?” etc.)
B) Scenario Script (Steps)
Setup
repo root contains at least some of:
README.md (may be missing or outdated)
package.json / requirements.txt / pyproject.toml etc.
src/ with entry point
docker-compose.yml / Makefile
memory dir is empty (fresh start)
policies: zero-dep retrieval, “never store secrets”, 65K budget
Steps
Step 1 — User question
human(message):
“what this project for?”
Expected system actions:
Create onboarding task (optional)
Plan minimal inspection
Step 2 — Minimal repo scan (tools)
agent(tool_call): list root directory
tool_result: returns file list
agent(tool_call): read README.md (if exists)
tool_result: README content

agent(tool_call): read package manifest (e.g., package.json)
tool_result: scripts, dependencies

agent(tool_call): locate entrypoint:

e.g., grep for “main()”, “createServer”, “app.listen”, etc. (bounded)
tool_result: small excerpt(s)
Optional (only if signals indicate):
read docker-compose.yml or Makefile targets
Step 3 — Agent synthesis
agent(message): answers: “This project appears to be …”
Should cite evidence refs (file+offset or chunk IDs) and mention confidence.
Optional:
agent(decision):

D1 “Project purpose hypothesis v0.1” with refs to evidence chunks
C) Acceptance Assertions (Memory + Performance + Curation)
C1. Ground truth persistence (P1)
events/YYYY-MM-DD.jsonl contains:
user message event
each tool_call event
each tool_result event
final agent message event
(optional) decision event
Assert: all are stored, append-only.
C2. Derived projections exist and are rebuildable (P2)
chunk_catalog.jsonl contains chunks derived from:
README excerpts
package manifest excerpts
entrypoint excerpts
term_postings/* updated for core terms (e.g., “server”, “cli”, “api”, “dashboard”)
Assert: deleting projections/micro/* and rebuilding from events reproduces catalog entries for the day.
C3. Active Context Bundle is curated, not bloated (P3)
ACB includes:
identity + rules views (small)
retrieved evidence chunks (only relevant excerpts)
ACB must not include full README or full dependency tree if huge, unless required and within caps.
Asserts:
acb_max_tokens <= 65000
retrieved_evidence.token_est <= 28000 (or your caps)
omissions contains entries if large tool outputs were trimmed
C4. Traceability (P4)
If a decision is produced:
Decision D1 has refs pointing to evidence chunks/events.
Assert: decision.refs non-empty and valid.
Even if no decision:

Final answer event includes citations/refs metadata (recommended as refs field).
C5. Fast curation (NFR-S)
For first run (cold-ish), allow retrieval path but bounded:
Asserts:

file_reads <= 20
bytes_read <= 8MB
candidate_pool_size <= 2000
p95_ms <= 500ms (or ≤1500ms for the very first cold start if you prefer)
C6. “Almost all dialog persisted”
Even though the answer is short, the system must store:
tool outputs (possibly chunked) in events/artifacts
not just summaries
Assert: tool_result content exists in ground truth or artifact store (with refs), not only in summary.
D) Why this scenario is realistic and useful
Legacy onboarding is a common “agentic dev” entry point:
requires tool use
requires synthesis
naturally produces a “purpose hypothesis” decision
creates a stable memory base for follow-up questions:
“How do I run it?”
“Where is the API defined?”
“What tests exist?”
“What are the main modules?”
And it stresses the memory system correctly:
must persist a lot, but inject little
must be fast
must be traceable
E) One important design choice for this scenario
To keep it fast without sqlite, the tool executor should produce excerpted results (bounded):
read_file: cap bytes, include line ranges
grep: cap matches and max lines per match
That way, the memory system never has to store or curate enormous tool results by default.
If you want, I can write the exact .scenario.yaml for this onboarding scenario including the assertion DSL (event_exists, acb_section_contains, bytes_read_max, etc.) and the required deterministic IDs (evt_..., chk_...) conventions.

나의 말:
now acording to our scenario just made. validate our SPEC. each interaction between memory module and outside, verify api or feature exist? and input / ouput match is important.

ChatGPT의 말:
Below is a spec validation against the “Legacy Project Onboarding” scenario. I’m treating this like an interface audit: for every interaction between the memory module and the outside world, I check whether the API/feature exists in the spec, and whether the inputs/outputs are defined well enough to implement and acceptance-test.
Where something is missing, I propose the minimal addition to the spec (still zero-dep, fast).

1) Scenario workflow checkpoints vs Spec coverage
Checkpoint S1 — User message arrives: “what this project for?”
Outside → Memory interactions
Ingress/Router → Recorder: append user message event
Ingress/Router → Orchestrator: request ACB for next call (intent=repo_onboarding)
Spec coverage
✅ Recorder event format exists (events/*.jsonl)
⚠️ Ingress→Orchestrator input is not formally defined as an API (only described conceptually).
Required API (add to spec)
Orchestrator.buildACB(input) → ACB
Input
channel: private|public|agent|team
intent: string (e.g., repo_onboarding)
query_text: string (the user message)
session_id
budget_tokens (defaults from budgets.yaml)
Output
ACB JSON (already defined)
provenance must include intent, query_terms, candidate_pool_size
Minimal addition: define this function signature explicitly.
Checkpoint S2 — Agent decides to inspect repo (tool plan)
Outside ↔ Memory interactions
Agent/Planner → Tools (outside memory)
Tools → Recorder: append tool_call/tool_result events
Projector → micro-indexes: build chunk catalog + postings from tool results
Spec coverage
✅ tool_call/tool_result kind exists
✅ micro-indexes exist: chunk_catalog, postings, recency ring, hotset
⚠️ Tool result “excerpting” is mentioned as recommendation but not normatively required, yet this scenario depends on it to stay fast and avoid huge context.
Required feature (add to spec)
Tool Result Normalization Contract (normative)
Tool results must be stored as:
content = { path, byte_range|line_range, excerpt_text, truncated: boolean, stats }
Hard caps:
max_bytes_per_tool_result_event
max_lines_per_match for grep-like tools
If exceeded, store full output in artifacts/tool_outputs/… and store only a pointer in event.
This is essential for:
speed NFR
“persist almost everything” without bloating event files
deterministic chunking
Checkpoint S3 — Projectors create chunks & indexes incrementally
Memory internal I/O
Recorder appends → Projector consumes new events → writes:
chunk_catalog.jsonl
term_postings/<shard>.json
recency_ring.json
hotset.json
Spec coverage
✅ File formats defined
⚠️ Missing: projector “incremental cursor” definition (how projectors know what’s new) and id conventions stability (chunk IDs based on event IDs + offsets).
Required API/feature (add)
Projector.update(from_event_id | from_offset) → UpdateReport
Input
last processed position (file + byte offset OR last event id)
Output
counts: events processed, chunks created
time spent
files touched
Must be deterministic given same events.
This is required for scenario assertions like “bounded rebuild / incremental updates.”
Checkpoint S4 — Orchestrator builds ACB after evidence exists
Outside → Memory interactions
Planner/Agent → Orchestrator.buildACB (now with repo evidence available)
Orchestrator → reads views + hotset + micro-indexes (postings + recency ring)
Orchestrator → outputs ACB including evidence chunk_refs
Spec coverage
✅ ACB JSON format exists
✅ candidate generation + scoring exists
⚠️ Missing: “Chunk materialization” contract. ACB currently references chunk_ref, but not defined how the LLM prompt gets actual text (excerpt) from a chunk_ref.
Required API/feature (add)
ChunkStore.getChunkText(chunk_id) → {text, source_evt, location}
Input: chunk_id
Output: text (excerpt), refs (event id + file position), token_est
Must be bounded I/O (no scanning), typically via:
chunk_id → source_evt → event content excerpt
or chunk_id → artifact pointer
Without this, ACB is not executable.
Checkpoint S5 — Agent produces final answer with citations/refs
Outside ↔ Memory interactions
Agent → Recorder: append final message event
Optional: Agent → Decision ledger (decision event + decisions.jsonl)
Spec coverage
✅ decision ledger schema exists
⚠️ Missing: “Answer provenance” format. Scenario expects citations like file+offset or chunk IDs. Spec mentions refs but doesn’t formalize where in the agent output those refs live.
Required addition (small)
Agent message event must include structured provenance:
{
  "kind":"message",
  "content": {
    "text":"...",
    "citations":[
      {"chunk_id":"chk_...", "label":"README purpose section"},
      {"chunk_id":"chk_...", "label":"package.json scripts"}
    ],
    "confidence": 0.72
  },
  "refs":["evt_..."]
}
This allows acceptance tests to verify grounding without parsing free text.
2) Spec compliance verdict for the scenario
What already matches well
✅ Ground truth event log model supports storing dialog + tool calls/results
✅ Micro-index architecture supports zero-dep retrieval without full scans
✅ ACB structure supports curated context under 65K
✅ Performance constraints and bounded candidate pool are present conceptually
What is missing (and must be added for acceptance tests to be implementable)
Formal Orchestrator API: buildACB(input) → ACB
Tool result normalization/excerpting contract (critical for speed + persistence)
Projector incremental cursor API (for bounded rebuild & deterministic updates)
Chunk materialization API: getChunkText(chunk_id) so ACB refs can be turned into prompt text
Structured citation/provenance in agent message events for validation
These are not “nice to have”; without them, the scenario can’t be executed deterministically or tested.
3) Minimal interface set (the “outside-facing” memory module APIs)
If you want the memory system to be a clean module, these are the only APIs outside code should call:
3.1 Recorder
Recorder.append(event) → {event_id}
Input: event object (validated, normalized, redacted)
Output: event_id
3.2 Projectors
Projectors.update(since_cursor) → UpdateReport
Input: cursor
Output: report (processed counts, new cursor)
3.3 Orchestrator
Orchestrator.buildACB(request) → ACB
Input: channel, intent, query_text, session_id, budget
Output: ACB object with chunk_refs
3.4 Chunk materialization (read path)
ChunkStore.materialize(acb) → PromptParts
Input: ACB
Output: actual text blocks ready to send to LLM, plus refs
This last one can be implemented as:
read views text
read chunk excerpts via chunk_catalog pointers
pack into final prompt
4) Scenario-specific acceptance assertions that become possible with these interfaces
With the missing interfaces added, you can validate precisely:
event_exists(kind=tool_result, content.path="README.md")
chunk_catalog_contains(source_evt=… , terms include “project”, “purpose”)
postings_contains(term="readme", includes chunk_id=…)
acb_section_contains("retrieved_evidence", chunk_id=…)
message_event.citations includes chunk_id=… (grounding)
performance: acb.provenance.candidate_pool_size <= 2000
performance: report.file_reads <= 20, bytes_read <= 8MB
5) Actionable patch list to update Spec v1.2
If you want, I can write the exact “Spec v1.3 patch” text, but the changes are:
Add Module APIs section with the four functions above
Add Tool Result Normalization section (excerpt/pointer rules)
Add Projector cursor definition (cursor = filename + byte offset, simplest)
Add Chunk materialization section (chunk_id → source)
Add Structured citations in message event schema
If you confirm that the memory system is intended to run as a daemon/service (long-lived) vs library (called per command), I can lock the cursor + caching model accordingly. If you don’t specify, I’ll assume library with optional daemon mode, because it keeps dependencies low while still enabling speed via hotset.

나의 말:
this memory system is not for only one agent, it serve multiple agent at same time. so daemon or service is suitable form. is THERE MCP work like this?

ChatGPT의 말:
Yes — a daemon/service memory system that serves multiple agents concurrently is a natural fit, and MCP can work in that shape, but the transport you choose matters.
Can MCP be a multi-agent shared daemon?
MCP in general
MCP defines a host ↔ client ↔ server architecture where servers expose tools/resources that AI apps can call. 
Concurrency depends on transport
Streamable HTTP transport: explicitly supports an MCP server running as an independent process handling multiple client connections (and optionally SSE). That’s the “daemon/shared service” shape you want. 
stdio transport: typically a 1:1 process connection pattern (a host spawns a server process and talks over stdio). It’s great locally, but it doesn’t naturally become a shared multi-client daemon without an external multiplexer. 
So: Yes, MCP can be used, and for a shared memory service you should target Streamable HTTP.
Practical caveat: “multi-client support” isn’t guaranteed in every SDK
In the MCP ecosystem, there have been discussions/issues about enhancing some server implementations to support multiple concurrent client connections cleanly. 
Also, questions around session isolation for a single deployed server instance show that you must design isolation yourself (tenant/session separation, per-client context boundaries). 
Meaning: MCP doesn’t automatically solve multi-tenant memory safety. Your service must.

Is MCP the right abstraction for “shared agent memory”?
MCP is primarily a way to expose tools and data access to agents. OpenAI’s docs also frame MCP servers as tool providers and mention practical issues like limiting exposed tools for cost/latency. 
That’s compatible with your memory service: your memory system becomes an MCP server that exposes tools like:
record_event
build_acb
get_chunk
get_handoff_packet
query_decisions
pin_memory
This fits MCP well.
(Also: OpenAI’s agents ecosystem explicitly mentions MCP support in their Agents SDK docs. )

What you must add to our spec for a multi-agent daemon
Your spec is close, but for “multiple agents at same time” you need 3 concrete protocol-level additions:
1) Session / tenant isolation (hard requirement)
Every API call must include:
tenant_id (or workspace_id)
session_id
agent_id
All stored artifacts must be keyed by these, and loading policies must prevent cross-tenant bleed.
This directly addresses the MCP session-isolation ambiguity. 

2) Concurrency control (append-only log + atomic writes)
For a shared daemon:
event append must be atomic
projector updates must be consistent under concurrent writes
The simplest approach (still zero-dep):
per-tenant event files (jsonl) rotated daily
append with OS atomic append semantics
projector uses a cursor (file + byte offset) per tenant
3) Transport choice: Streamable HTTP MCP server
Because you want multiple agents and likely multi-process clients, use streamable HTTP transport.
Direct answer to “is there MCP work like this?”
Yes:
MCP servers can be deployed as independent processes, and with Streamable HTTP they can handle multiple clients — which matches a shared memory daemon. 
But:
Some reference implementations historically assume simpler 1:1 patterns, and you must implement session isolation and concurrency boundaries yourself. 
If you want, next I can do a spec patch: “MCP-facing API surface for Memory Daemon v1” (tool names, request/response JSON shapes, required IDs, and the exact mapping to our internal Recorder/Projector/Orchestrator/ChunkStore).




출처

나의 말:
i want keep system simple. it mean memory system's code size small. to achieve this i can take external library and storage(ex database) dependency .  in this point of view . re-design and new spec please

ChatGPT의 말:
Understood: you want the simplest possible implementation (small codebase), and you’re willing to take external dependencies (DB + libraries) to keep your code minimal.
Below is a re-designed spec optimized for minimum custom code while still supporting:

multi-agent concurrent access (daemon/service)
“persist almost everything”
fast active-context curation (65K budget)
scenario-driven acceptance testing
I’ll call this Spec v2 (Thin Memory Daemon).
Memory System Spec v2: Thin Memory Daemon
0) Design goal
Minimize your code, not dependencies.
Strategy:

Push complexity into a mature database + proven libraries.
Keep your daemon logic to: record → index → retrieve → pack.
1) Architecture
1.1 Components (minimal)
Memory Daemon (MCP Server, HTTP transport)
exposes a small tool API
stateless except DB connection + caches
Database (single source of truth)
stores events, chunks, decisions, tasks, artifacts metadata
provides retrieval via built-in indexing (FTS + optional vector)
That’s it. No filesystem event logs, no custom postings, no micro-index files.
1.2 Storage choice (recommended)
Option A (best simplicity + performance): PostgreSQL
JSONB for flexible event schema
native indexing (GIN) for tags/fields
full-text search (tsvector) for lexical retrieval
optional: pgvector for semantic retrieval (later; can be v2.1)
Option B (very small install footprint): SQLite
FTS5 for lexical retrieval
works well locally, but multi-agent concurrency is more fragile than Postgres
I’ll specify Postgres-first because you explicitly want a daemon for multiple agents.
2) Data model (Postgres)
2.1 Tables (minimal set)
events (ground truth)
event_id (PK, ULID recommended)
ts (timestamptz)
tenant_id (text)
session_id (text)
channel (text: private/public/team/agent)
actor_type (human/agent/tool)
actor_id (text)
kind (message/tool_call/tool_result/decision/task_update/artifact)
sensitivity (none/low/high/secret)
tags (text[])
content (jsonb) ← raw payload, excerpted if large
refs (text[]) ← event refs
indexes: (tenant_id, ts), (tenant_id, session_id, ts), GIN(tags), GIN(content)
chunks (retrieval unit)
chunk_id (PK)
tenant_id
event_id (FK)
ts
kind
token_est (int)
importance (real)
text (text) ← excerpt or normalized text
tsv (tsvector) ← generated column for FTS
optional embedding (vector) if using pgvector
indexes: GIN(tsv), (tenant_id, ts), (tenant_id, kind)
decisions
decision_id (PK)
tenant_id
ts
status (active/superseded)
scope (project/user/global)
decision (text)
rationale (jsonb or text[])
constraints (text[])
alternatives (text[])
consequences (text[])
refs (text[]) ← event_ids or chunk_ids
index: (tenant_id, status), GIN(refs)
tasks (optional but useful)
task_id (PK)
tenant_id
ts
status (open/doing/done)
title
details (text)
refs (text[])
artifacts (optional)
artifact_id (PK)
tenant_id
ts
kind (tool_output/blob)
uri (text) or bytes (bytea) depending on your choice
meta (jsonb)
refs (text[])
3) Ingestion rules (keep code tiny)
3.1 One write path: record_event
When the daemon receives any event:
Insert into events
Convert event → 0..N chunks (usually 1)
Insert chunk text (excerpted) + token_est + importance
If kind=decision/task_update, also upsert into decisions/tasks
That’s the whole ingestion pipeline. No separate projector service.
3.2 Tool result size control (mandatory)
To keep DB stable and ACB fast:
tool_result stored as excerpt in events.content.excerpt_text
full payload stored in artifacts only if needed
chunk text uses excerpt
This matches your legacy repo onboarding scenario and keeps curation fast.
4) Active Context Bundle (ACB) assembly
4.1 API: build_acb
Input
tenant_id, session_id, agent_id
channel
query_text
intent
max_tokens = 65000
Output
ACB sections with embedded text blocks (not just refs), plus provenance and refs
4.2 Retrieval (zero custom indexing)
Candidate retrieval uses DB:
Lexical retrieval (baseline)
query → plainto_tsquery / websearch_to_tsquery
get top N chunks by ts_rank(tsv, query) with filters:
tenant_id
sensitivity allowed for channel
time window bias (prefer last 30 days unless query indicates “history”)
Recency + importance boost (simple)
Final score computed in SQL or in daemon:
score = 0.6*fts_rank + 0.3*recency_decay + 0.1*importance
Then pack into sections until budgets reached.
4.3 Section budgets (same concept, simpler implementation)
identity/rules (small)
task_state
decisions (active first)
evidence chunks (retrieved)
recent window (last N events in session)
Packing uses token_est stored per chunk.
5) Multi-agent daemon requirements
5.1 Isolation
Every request must include:
tenant_id
session_id
agent_id
The daemon must never cross tenant boundaries in queries.
5.2 Concurrency
Postgres handles concurrent writes.
Your code must:
use one transaction per record_event
optionally batch chunk inserts for speed
6) MCP tool surface (small)
Expose only these tools (keep it tiny):
record_event
build_acb
query_decisions (optional convenience)
create_handoff_packet (optional; can be “decision + task + refs”)
get_artifact (only if you store big tool outputs)
Everything else can be done by the agent using normal tools.
7) Scenario-driven acceptance tests (updated for DB)
Re-use your legacy onboarding scenario, but now assertions check DB state + ACB output:
SCN-A1 (Legacy repo onboarding)
Key acceptance assertions
events contains message/tool_call/tool_result/answer rows for tenant/session
chunks contain excerpts from README/package/entrypoint results
build_acb returns:
≤ 65K token_est total
includes evidence blocks referencing README/package/entrypoint
does NOT include huge tool output (only excerpt; full payload in artifacts if stored)
performance:
p95 build_acb within target (DB index makes this realistic)
You can implement tests as:
scenario runner calls MCP tools
then queries DB directly (or via admin tool) to assert expected state
8) Why this is simpler than v1.x
v1.x needed:
append-only files
micro-index maintenance
postings sharding
ring buffers
rebuild cursors
chunk materialization from files
v2 reduces your code to:
DB writes
DB queries
packing logic
policy checks
You’re trading dependencies for less custom machinery.
9) Open choices (defaults that keep code small)
To keep this moving, I’d lock these defaults:
DB: Postgres
Retrieval: FTS only (v2.0)
Optional v2.1: pgvector for semantic recall
Artifact storage: either bytea in DB (simpler) or S3/local (scales better, more code)
Next step
If you answer one thing, I can finalize v2 into an implementable “API + SQL DDL” spec:
Do you want artifacts (big tool outputs) stored:

(1) in Postgres bytea (simplest, smallest code), or
(2) external object storage (more scalable, more code)?
If you don’t choose, I’ll default to (1) for simplicity.

나의 말:
i will use postgres. 

ChatGPT의 말:
Good. Below is a finalized Spec v2.0 (Postgres-backed, multi-agent daemon, minimal code) that covers the legacy onboarding scenario and provides clear APIs + DB DDL + I/O contracts.
Memory System Spec v2.0 (Postgres Thin Daemon)
1) Goals
Serve multiple agents concurrently (daemon/service).
Persist almost all interactions (messages, tool I/O, decisions, task state).
Build Active Context Bundle (ACB) up to 65K tokens via fast curation.
Keep daemon code small by delegating indexing/retrieval to Postgres.
2) Runtime Shape
2.1 Deployment
Long-running service (HTTP).
Exposes a small tool API (MCP-friendly surface, but can be plain HTTP first).
2.2 Required request identity (multi-agent isolation)
Every API call MUST include:
tenant_id (workspace)
session_id
agent_id
channel (private|public|team|agent)
All queries MUST filter by tenant_id.
3) Postgres Data Model
3.1 DDL (minimum viable)
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ground truth events (append-only logically)
CREATE TABLE IF NOT EXISTS events (
  event_id     TEXT PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id    TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  channel      TEXT NOT NULL,
  actor_type   TEXT NOT NULL, -- human|agent|tool
  actor_id     TEXT NOT NULL,
  kind         TEXT NOT NULL, -- message|tool_call|tool_result|decision|task_update|artifact
  sensitivity  TEXT NOT NULL DEFAULT 'none', -- none|low|high|secret
  tags         TEXT[] NOT NULL DEFAULT '{}',
  content      JSONB NOT NULL,
  refs         TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_ts
  ON events (tenant_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_events_tenant_session_ts
  ON events (tenant_id, session_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_events_tags_gin
  ON events USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_events_content_gin
  ON events USING GIN (content);


-- Retrieval units (excerpts / normalized text)
CREATE TABLE IF NOT EXISTS chunks (
  chunk_id     TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  event_id     TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  ts           TIMESTAMPTZ NOT NULL,
  kind         TEXT NOT NULL,
  channel      TEXT NOT NULL,
  sensitivity  TEXT NOT NULL DEFAULT 'none',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  token_est    INT NOT NULL,
  importance   REAL NOT NULL DEFAULT 0.0,
  text         TEXT NOT NULL,
  tsv          TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);

CREATE INDEX IF NOT EXISTS idx_chunks_tenant_ts
  ON chunks (tenant_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_chunks_tenant_kind
  ON chunks (tenant_id, kind);

CREATE INDEX IF NOT EXISTS idx_chunks_tsv_gin
  ON chunks USING GIN (tsv);

CREATE INDEX IF NOT EXISTS idx_chunks_tags_gin
  ON chunks USING GIN (tags);


-- Decisions (first-class, traceable)
CREATE TABLE IF NOT EXISTS decisions (
  decision_id   TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL,  -- active|superseded
  scope         TEXT NOT NULL,  -- project|user|global
  decision      TEXT NOT NULL,
  rationale     TEXT[] NOT NULL DEFAULT '{}',
  constraints   TEXT[] NOT NULL DEFAULT '{}',
  alternatives  TEXT[] NOT NULL DEFAULT '{}',
  consequences  TEXT[] NOT NULL DEFAULT '{}',
  refs          TEXT[] NOT NULL DEFAULT '{}' -- event_ids or chunk_ids
);

CREATE INDEX IF NOT EXISTS idx_decisions_tenant_status_ts
  ON decisions (tenant_id, status, ts DESC);


-- Tasks (optional but useful for agentic dev)
CREATE TABLE IF NOT EXISTS tasks (
  task_id     TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT NOT NULL, -- open|doing|done
  title       TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  refs        TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_ts
  ON tasks (tenant_id, status, ts DESC);


-- Artifacts: store large tool outputs simply (bytea)
CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id  TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind         TEXT NOT NULL, -- tool_output|blob
  bytes        BYTEA,
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  refs         TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_ts
  ON artifacts (tenant_id, ts DESC);
Note: “Append-only” is enforced by application policy. DB constraints aren’t strictly required, keeping code + schema simple.
4) Ingestion Contracts (Input/Output)
4.1 record_event (the only write API you need)
Request
{
  "tenant_id": "t1",
  "session_id": "s1",
  "channel": "private",
  "actor": {"type":"human","id":"user"},
  "kind": "message",
  "sensitivity": "none",
  "tags": ["topic:onboarding","repo:legacy"],
  "content": { "text": "what this project for?" },
  "refs": []
}
Response
{ "event_id": "evt_01J..." }
4.2 Mandatory normalization for tool results (critical for speed)
For kind=tool_result, daemon MUST enforce:
Store excerpt in events.content.excerpt_text
If full output exceeds limits, store full bytes in artifacts.bytes, and store pointer in event content.
Tool result content shape
{
  "tool": "fs.read_file",
  "path": "README.md",
  "excerpt_text": "....",
  "line_range": [1, 120],
  "truncated": true,
  "artifact_id": "art_01J..."  // present only when truncated due to size
}
Why: Your legacy onboarding scenario requires large files/tools without slowing ACB assembly or bloating context.
4.3 Automatic chunking (daemon responsibility)
On every record_event, daemon creates 0..N rows in chunks:
Usually 1 chunk per event (message / tool_result excerpt / decision text)
text comes from:
message content.text
tool_result content.excerpt_text
decision decision + rationale (optional)
token_est computed once at insert time
importance heuristic (small, deterministic):
for decisions/tasks
for pinned tags (optional)
for “README”, “entrypoint”, etc. if tool_result
5) Read/Serve Contracts (Active Context)
5.1 build_acb (primary read API)
Request
{
  "tenant_id": "t1",
  "session_id": "s1",
  "agent_id": "agentA",
  "channel": "private",
  "intent": "repo_onboarding",
  "query_text": "what this project for?",
  "max_tokens": 65000
}
Response (ACB)
Returns ready-to-prompt text blocks, not just refs, to keep client code tiny.
{
  "acb_id": "acb_01J...",
  "budget_tokens": 65000,
  "token_used_est": 18400,
  "sections": [
    {
      "name": "rules",
      "items": [
        {"type":"text","text":"(identity/rules text...)","refs":["view:rules.project"]}
      ],
      "token_est": 1200
    },
    {
      "name": "recent_window",
      "items": [
        {"type":"text","text":"User: what this project for?","refs":["evt_01J..."]}
      ],
      "token_est": 120
    },
    {
      "name": "retrieved_evidence",
      "items": [
        {"type":"text","text":"README excerpt...","refs":["chk_01J...","evt_01J..."]},
        {"type":"text","text":"package.json scripts excerpt...","refs":["chk_01J..."]}
      ],
      "token_est": 9000
    },
    {
      "name": "relevant_decisions",
      "items": [
        {"type":"decision","decision_id":"dec_01J...","text":"...","refs":["evt_..."]}
      ],
      "token_est": 800
    }
  ],
  "omissions": [
    {"reason":"truncated_tool_output","candidates":["evt_..."],"artifact_id":"art_..."}
  ],
  "provenance": {
    "intent": "repo_onboarding",
    "query_terms": ["project","for"],
    "candidate_pool_size": 800,
    "filters": {"sensitivity_allowed":["none","low","high"]},
    "scoring": {"alpha":0.6,"beta":0.3,"gamma":0.1}
  }
}
5.2 Retrieval method (FTS baseline; minimal code)
Candidate query (conceptual):
tsquery = websearch_to_tsquery('english', query_text)
Select top N from chunks where:
tenant_id = ?
sensitivity allowed for channel
order by rank + recency + importance
Keep it bounded:
candidate_pool_max = 2000
retrieved_chunks_max = 200
pack using token_est until section caps
6) Privacy Policy (simple, enforceable)
Channel-based suppression (hard-coded or config table/file):
public: allow sensitivity none|low only; exclude preferences
private: allow none|low|high; never allow secret
agent: usually none|low unless explicitly permitted
v2.0 recommendation: never store secrets (redact), to minimize code and risk.
7) Performance Requirements (fast curation)
Targets (local baseline, indexed DB):
Fast path (no retrieval needed): p95 ≤ 150ms
Retrieval path (FTS): p95 ≤ 500ms
Worst-case cold start: ≤ 1500ms
Hard limits:
candidate_pool_max = 2000
retrieved_chunks_max = 200
max_bytes_per_tool_result_event (e.g., 64KB excerpt)
packing uses precomputed token_est (no repeated tokenization)
8) Acceptance Scenario Mapping (Legacy repo onboarding)
For your scenario (“repo root → user asks ‘what is this project for?’”):
Required external feature surface
Tools (outside memory): fs.list_root, fs.read_file, fs.grep (bounded outputs)
Memory daemon endpoints/tools:
record_event
build_acb
(optional) get_artifact(artifact_id) if the agent wants full tool output later
What the scenario validates in this spec
All interactions are stored (events)
Large tool outputs don’t slow the system (excerpt + artifact)
ACB includes only relevant excerpts (FTS retrieval + packing)
Decisions can be created and cited (decision table + refs)
Multi-agent safe (tenant/session/agent isolation keys)
9) Minimal MCP Tool Mapping (optional, if you adopt MCP)
If you expose via MCP, these are the only tools you need:
memory.record_event
memory.build_acb
memory.get_artifact (optional)
memory.query_decisions (optional convenience)
Keep the rest out to stay small.

