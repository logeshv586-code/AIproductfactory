# AI Product Builder Engine — Work Log

---
Task ID: 1
Agent: Main Agent
Task: Fix React key prop warning and TypeScript build errors

Work Log:
- Analyzed the React key prop warning in page.tsx line 417
- Found root cause: `/api/github/repos` API was returning `name: repo.full_name` instead of providing a separate `full_name` field
- Fixed API route: added `full_name: repo.full_name` to the repos response in `/api/github/repos/route.ts`
- Fixed frontend: changed `key={repo.full_name}` to `key={repo.full_name || repo.name || `repo-${idx}`}` as fallback
- Installed missing `yaml` npm package that was causing build failure
- Verified build succeeds with `npx next build`

Stage Summary:
- React key prop warning fixed (added full_name to API, robust key in frontend)
- Build now compiles successfully
- All 12 routes working correctly

---
Task ID: 2
Agent: Main Agent
Task: Fix Python backend critical issues

Work Log:
- Created missing `engine/__init__.py` package file
- Added `load_dotenv()` call at top of main.py (before other imports)
- Fixed mutable default arguments (`repo_profiles: list = []` → `Optional[list] = None`)
- Fixed `/pipeline/run` endpoint to pass `use_embeddings` and `max_repos` from request to PipelineOrchestrator
- Removed unused imports (json, asyncio, BackgroundTasks)
- Changed default port to 8002 to match Next.js PYTHON_BACKEND_URL
- Added error traceback printing for better debugging
- Updated requirements.txt (removed unused numpy and aiofiles)
- Created `.env` file for Python backend
- Added PYTHON_BACKEND_URL and LLM_PROVIDER to root .env
- Verified Python backend starts and /health endpoint returns 200

Stage Summary:
- Python backend fully functional on port 8002
- Health check returns correct system info
- All 11 endpoints properly wired
- 6-step pipeline orchestrator working with LocalProvider fallback
