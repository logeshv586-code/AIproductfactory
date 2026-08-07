import json
import time
import urllib.request
import urllib.error

BACKEND_URL = "http://localhost:8001"
FRONTEND_URL = "http://localhost:3000"

def post(url, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')

def get(url):
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode('utf-8')
            try:
                return resp.status, json.loads(body)
            except Exception:
                return resp.status, body[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')

def run_tests():
    results = []

    print("--- 1. Testing Backend /health ---")
    st, res = get(f"{BACKEND_URL}/health")
    print(f"Health: status={st}, version={res.get('version') if isinstance(res, dict) else res}")
    results.append(("Backend /health", st == 200, f"Status: {st}"))

    print("\n--- 2. Testing Intent Extraction (/intent/extract) ---")
    st, res = post(f"{BACKEND_URL}/intent/extract", {"user_input": "Build an AI chatbot for customer support"})
    print(f"Intent Extract: status={st}, success={res.get('success') if isinstance(res, dict) else False}")
    results.append(("Backend /intent/extract", st == 200, f"Status: {st}"))

    print("\n--- 3. Testing Capabilities Mapping (/capabilities/map) ---")
    sample_repos = [{"name": "repo1", "description": "AI chatbot framework with vector memory", "topics": ["ai", "chatbot"]}]
    st, res = post(f"{BACKEND_URL}/capabilities/map", {"repos": sample_repos, "use_embeddings": True})
    print(f"Capabilities Map: status={st}")
    results.append(("Backend /capabilities/map", st == 200, f"Status: {st}"))

    print("\n--- 4. Testing Graphify (/graph/build) ---")
    st, res = post(f"{BACKEND_URL}/graph/build", {"repos": sample_repos, "capabilities": []})
    print(f"Graph Build: status={st}, node count={res.get('stats', {}).get('num_nodes') if isinstance(res, dict) else 'N/A'}")
    results.append(("Backend /graph/build", st == 200, f"Status: {st}"))

    print("\n--- 5. Testing Skills List (/skills/list) ---")
    st, res = get(f"{BACKEND_URL}/skills/list")
    print(f"Skills List: status={st}, count={len(res.get('skills', [])) if isinstance(res, dict) else 'N/A'}")
    results.append(("Backend /skills/list", st == 200, f"Status: {st}"))

    print("\n--- 6. Testing LLM Router (/llm/route) ---")
    st, res = post(f"{BACKEND_URL}/llm/route", {"prompt": "Hello world test", "task_type": "chat"})
    print(f"LLM Route: status={st}, provider={res.get('provider') if isinstance(res, dict) else 'N/A'}")
    results.append(("Backend /llm/route", st == 200, f"Status: {st}"))

    print("\n--- 7. Testing LLM Metrics (/llm/metrics) ---")
    st, res = get(f"{BACKEND_URL}/llm/metrics")
    print(f"LLM Metrics: status={st}")
    results.append(("Backend /llm/metrics", st == 200, f"Status: {st}"))

    print("\n--- 8. Testing PI Memory (/pi/memory) ---")
    st, res = get(f"{BACKEND_URL}/pi/memory")
    print(f"PI Memory: status={st}, count={res.get('count') if isinstance(res, dict) else 'N/A'}")
    results.append(("Backend /pi/memory", st == 200, f"Status: {st}"))

    print("\n--- 9. Testing PI Strategize (/pi/strategize) ---")
    t0 = time.time()
    st, res = post(f"{BACKEND_URL}/pi/strategize", {
        "idea": "An automated AI video summary tool for tech tutorials",
        "strategy": "all",
        "use_embeddings": True
    })
    elapsed = time.time() - t0
    print(f"PI Strategize: status={st}, elapsed={elapsed:.2f}s, run_id={res.get('run_id') if isinstance(res, dict) else 'N/A'}")
    results.append(("Backend /pi/strategize", st == 200, f"Status: {st}, time: {elapsed:.2f}s"))

    run_id = res.get('run_id') if isinstance(res, dict) and st == 200 else None

    if run_id:
        print(f"\n--- 10. Testing PI Explain (/pi/explain) for run {run_id} ---")
        st_exp, res_exp = post(f"{BACKEND_URL}/pi/explain", {"run_id": run_id})
        print(f"PI Explain: status={st_exp}, success={res_exp.get('success') if isinstance(res_exp, dict) else False}")
        results.append(("Backend /pi/explain", st_exp == 200, f"Status: {st_exp}"))

        print(f"\n--- 11. Testing PI Tournament (/pi/tournament) for run {run_id} ---")
        st_trn, res_trn = get(f"{BACKEND_URL}/pi/tournament?run_id={run_id}")
        print(f"PI Tournament: status={st_trn}, success={res_trn.get('success') if isinstance(res_trn, dict) else False}")
        results.append(("Backend /pi/tournament", st_trn == 200, f"Status: {st_trn}"))

        print(f"\n--- 12. Testing PI Approve (/pi/approve) for run {run_id} ---")
        st_app, res_app = post(f"{BACKEND_URL}/pi/approve", {
            "run_id": run_id,
            "chosen_strategy": "tournament_winner",
            "build_target": "starter_repo"
        })
        print(f"PI Approve: status={st_app}, success={res_app.get('success') if isinstance(res_app, dict) else False}")
        results.append(("Backend /pi/approve", st_app == 200, f"Status: {st_app}"))

    print("\n--- 13. Testing Frontend Home Page (http://localhost:3000/) ---")
    st, res = get(f"{FRONTEND_URL}/")
    print(f"Frontend Home Page: status={st}")
    results.append(("Frontend Home Page (3000)", st == 200, f"Status: {st}"))

    print("\n--- 14. Testing Frontend Health API (http://localhost:3000/api/health) ---")
    st, res = get(f"{FRONTEND_URL}/api/health")
    print(f"Frontend API /health: status={st}")
    results.append(("Frontend /api/health", st == 200 or st == 404, f"Status: {st}"))

    print("\n================ SUMMARY ================")
    all_passed = True
    for name, ok, detail in results:
        status_str = "PASS" if ok else "FAIL"
        if not ok:
            all_passed = False
        print(f"[{status_str}] {name}: {detail}")
    
    print(f"\nOVERALL RESULT: {'ALL PASSED' if all_passed else 'SOME FAILED'}")

if __name__ == "__main__":
    run_tests()
