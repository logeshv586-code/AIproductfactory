export const SOURCE_CATALOG = [
  { id: 'github-deep', name: 'GitHub deep inspection', mode: 'core', purpose: 'Existing products, README, repository structure, manifests, representative source files, releases, maintenance and license evidence' },
  { id: 'github-source-proof', name: 'GitHub source proof', mode: 'core', purpose: 'Clickable README and capability-bearing source files inspected before a repository can qualify' },
  { id: 'gitlab', name: 'GitLab', mode: 'live', purpose: 'Relevant public projects beyond GitHub' },
  { id: 'huggingface', name: 'Hugging Face', mode: 'live', purpose: 'Open models and runnable AI assets when the idea requires model capabilities' },
  { id: 'web', name: 'Broad web research', mode: 'configured', purpose: 'Current competitors, product pages, pricing and market evidence when TAVILY_API_KEY is configured' },
  { id: 'arxiv', name: 'arXiv', mode: 'expert', purpose: 'Directly relevant technical methods only; unrelated papers are rejected' },
] as const

export const STOP = new Set([
  'about', 'after', 'again', 'also', 'another', 'because', 'before', 'being', 'build', 'building', 'create',
  'customer', 'customers', 'does', 'from', 'have', 'into', 'make', 'making', 'more', 'most', 'only', 'other',
  'product', 'products', 'should', 'some', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'through', 'using', 'want', 'with', 'within', 'without', 'would', 'your', 'application', 'software', 'easily',
])

export const SYNONYMS: Record<string, string[]> = {
  sales: ['crm', 'lead', 'prospect', 'outreach', 'pipeline', 'contact', 'email', 'enrichment'],
  video: ['media', 'generation', 'diffusion', 'animation', 'render', 'image', 'multimodal'],
  document: ['pdf', 'ocr', 'docx', 'pptx', 'powerpoint', 'word', 'excel', 'spreadsheet', 'office'],
  automation: ['workflow', 'agent', 'task', 'trigger', 'approval', 'integration', 'orchestration', 'rpa'],
  desktop: ['computer-use', 'gui', 'screen', 'mouse', 'keyboard', 'rpa', 'accessibility', 'uiautomation'],
  vision: ['screen', 'screenshot', 'ocr', 'multimodal', 'computer-vision', 'visual'],
  autonomous: ['agent', 'planner', 'reflection', 'memory', 'tool-use', 'self-improvement', 'agentic'],
  ai: ['llm', 'agent', 'rag', 'embedding', 'model', 'inference', 'prompt', 'multimodal'],
  search: ['retrieval', 'index', 'query', 'semantic', 'vector'],
  authentication: ['auth', 'oauth', 'sso', 'identity', 'rbac'],
  monitoring: ['observability', 'metrics', 'telemetry', 'tracing', 'logs'],
}

export const GENERIC_CAPABILITIES = new Set([
  'Backend API', 'Frontend UI', 'Authentication', 'Data Store', 'Monitoring', 'Observability', 'Scheduling',
  'Error Handling', 'Audit Logging', 'Execution Runner', 'Workflow Engine', 'Notifications', 'Search',
])

export const CAPABILITY_RULES: Array<{
  name: string
  pattern: RegExp
  query: string
  positive: RegExp[]
  requireAction?: RegExp
  negativeOnly?: RegExp
}> = [
  {
    name: 'Desktop computer control',
    pattern: /desktop|computer use|computer-use|screen control|mouse|keyboard|rpa|windows app|desktop app/i,
    query: 'desktop automation computer use gui agent',
    positive: [/computer[- ]?use/i, /desktop/i, /uiautomation|ui automation|accessibility tree/i, /pyautogui|pywinauto|win32|wincom/i, /mouse|keyboard|click|keystroke/i],
    requireAction: /click|type|keyboard|mouse|invoke|set_value|scroll|launch|control|automation|executor/i,
  },
  {
    name: 'Vision screen understanding',
    pattern: /vision|visual|screen|screenshot|image understand|ocr|multimodal/i,
    query: 'vision screen understanding computer use agent',
    positive: [/vision|multimodal|vlm/i, /screenshot|screen capture/i, /ocr|image recognition|grounding/i, /visual control|gui grounding/i],
    requireAction: /screen|desktop|gui|computer|element|coordinate|control/i,
  },
  {
    name: 'PowerPoint automation',
    pattern: /powerpoint|pptx|\bppt\b|presentation/i,
    query: 'powerpoint pptx presentation automation agent',
    positive: [/powerpoint|pptx|presentation|slides?/i, /python-pptx|powerpoint com|pptxgenjs/i],
    requireAction: /create|generate|edit|write|insert|format|update|automation|executor|com/i,
    negativeOnly: /convert|extract|parse|markdown/i,
  },
  {
    name: 'Excel automation',
    pattern: /excel|xlsx|spreadsheet|workbook|worksheet/i,
    query: 'excel xlsx spreadsheet workbook automation agent',
    positive: [/excel|xlsx|spreadsheet|workbook|worksheet/i, /openpyxl|xlwings|xlsxwriter|excel com/i],
    requireAction: /create|generate|edit|write|insert|format|update|formula|chart|automation|executor|com/i,
    negativeOnly: /dataset|download|scrap|crawl|extract only/i,
  },
  {
    name: 'Word document automation',
    pattern: /word document|docx|document automation|office document|microsoft word/i,
    query: 'microsoft word docx document automation agent',
    positive: [/microsoft word|wordcom|docx|python-docx|office document/i],
    requireAction: /create|generate|edit|write|insert|format|update|table|automation|executor|com/i,
    negativeOnly: /convert|extract|parse|markdown/i,
  },
  {
    name: 'Browser automation',
    pattern: /browser|website|web automation|playwright|selenium/i,
    query: 'browser automation agent playwright selenium',
    positive: [/browser|playwright|selenium|chromium/i, /computer[- ]?use|web agent/i],
    requireAction: /click|navigate|type|page|browser|automation|tool/i,
  },
  {
    name: 'Autonomous task planning',
    pattern: /autonomous|autonomously|agentic|self evolving|self-evolving|self improve|self-improve|plan task/i,
    query: 'autonomous agent task planning tool use executor',
    positive: [/agent|planner|planning|react loop|state machine/i, /tool use|tool-use|executor|action/i, /multi-agent|orchestrator/i],
    requireAction: /plan|reason|decide|execute|iterate|loop|state|task/i,
  },
  {
    name: 'Memory and learning loop',
    pattern: /memory|self evolving|self-evolving|self improve|self-improve|learn every|feedback loop|experience/i,
    query: 'agent memory reflection self improvement experience learning',
    positive: [/memory|experience|execution trace|demonstration/i, /reflection|self[- ]?improv|learning loop/i, /rag|retrieval|knowledge substrate|vector/i],
    requireAction: /agent|task|workflow|execution|learn|retrieve|adapt/i,
  },
  {
    name: 'Workflow orchestration',
    pattern: /automation|workflow|orchestration|schedule|trigger|approval/i,
    query: 'workflow automation orchestration agent task runner',
    positive: [/workflow|orchestrator|pipeline|task graph/i, /scheduler|trigger|queue|runner/i],
    requireAction: /execute|run|task|workflow|trigger|schedule|step/i,
  },
  {
    name: 'Tool and skill execution',
    pattern: /any task|tool use|tool-use|skills|plugin|execute task|automation/i,
    query: 'agent tool use skills mcp executor plugin automation',
    positive: [/tool[- ]?use|tools?|skills?|plugin|mcp/i, /executor|action server|command/i],
    requireAction: /execute|call|invoke|run|action|tool|skill/i,
  },
  {
    name: 'Local AI inference',
    pattern: /local ai|offline|ollama|lm studio|local model/i,
    query: 'local llm agent ollama lm studio computer use',
    positive: [/ollama|lm studio|llama\.cpp|local inference|local model/i],
    requireAction: /model|inference|llm|vision|agent/i,
  },
  {
    name: 'Human approval and audit',
    pattern: /approval|audit|governance|review before|human/i,
    query: 'human approval workflow audit agent automation',
    positive: [/approval|human[- ]in[- ]the[- ]loop|review gate/i, /audit|rbac|permission|policy/i],
    requireAction: /workflow|agent|task|action|execute|approve/i,
  },
]
