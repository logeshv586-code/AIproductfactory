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
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body[:200]
    except Exception as e:
        return 'ERR', str(e)

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
    except Exception as e:
        return 'ERR', str(e)

def run_tests():
    results = []
    print("==================================================")
    print("  AI Product Builder Engine - Full System Verification")
    print("==================================================\n")

    # 1. Health
    print("[1/10] Testing Backend Health (/health)...")
    st, res = get(f"{BACKEND_URL}/health")
    ok = (st == 200 and isinstance(res, dict) and res.get('status') == 'running')
    print(f"      Result: status={st}, version={res.get('version') if ok else res}")
    results.append(("Backend /health", ok, f"Version {res.get('version') if ok else 'N/A'}"))

    # 2. Intent Extraction
    print("[2/10] Testing Intent Extraction (/intent/extract)...")
    st, res = post(f"{BACKEND_URL}/intent/extract", {"user_input": "Build a scalable developer tool for API testing"})
    ok = (st == 200 and isinstance(res, dict) and res.get('success') is True)
    print(f"      Result: status={st}, success={ok}")
    results.append(("Backend /intent/extract", ok, f"Success: {ok}"))

    # 3. Skills List
    print("[3/10] Testing Skills Engine (/skills/list)...")
    st, res = get(f"{BACKEND_URL}/skills/list")
    ok = (st == 200 and isinstance(res, dict) and res.get('success') is True)
    skills = res.get('skills', []) if ok else []
    print(f"      Result: status={st}, skills count={len(skills)}")
    results.append(("Backend /skills/list", ok, f"Available skills: {len(skills)}"))

    # 4. LLM Routing
    print("[4/10] Testing LLM Provider Routing (/llm/route)...")
    st, res = post(f"{BACKEND_URL}/llm/route", {
        "messages": [{"role": "user", "content": "Respond briefly: System operational status."}],
        "max_tokens": 50
    })
    ok = (st == 200 and isinstance(res, dict) and res.get('success') is True)
    print(f"      Result: status={st}, provider={res.get('provider') if ok else 'N/A'}")
    results.append(("Backend /llm/route", ok, f"Provider: {res.get('provider') if ok else 'N/A'}"))

    # 5. Graph Building
    print("[5/10] Testing Knowledge Graph Construction (/graph/build)...")
    st, res = post(f"{BACKEND_URL}/graph/build", {
        "repos": [{"name": "repo-alpha", "description": "Fast API framework", "topics": ["api"]}],
        "capabilities": []
    })
    ok = (st == 200 and isinstance(res, dict) and res.get('success') is True)
    print(f"      Result: status={st}, success={ok}")
    results.append(("Backend /graph/build", ok, f"Graph built: {ok}"))

    # 6. PI Memory Retrieval & Search
    print("[6/10] Testing Product Memory (/pi/memory & /pi/memory/search)...")
    st1, res1 = get(f"{BACKEND_URL}/pi/memory")
    st2, res2 = post(f"{BACKEND_URL}/pi/memory/search", {"idea": "AI customer support bot"})
    ok = (st1 == 200 and st2 == 200)
    print(f"      Result: memory_list={st1}, memory_search={st2}")
    results.append(("Backend /pi/memory", ok, f"List status: {st1}, Search status: {st2}"))

    # 7. PI Strategize (Full reasoning pipeline)
    print("[7/10] Testing Product Intelligence Strategize (/pi/strategize)...")
    t0 = time.time()
    st, res = post(f"{BACKEND_URL}/pi/strategize", {
        "idea": "An AI platform for automated software documentation generation"
    })
    elapsed = time.time() - t0
    ok = (st == 200 and isinstance(res, dict) and res.get('success') is True)
    run_id = res.get('run_id') if ok else None
    print(f"      Result: status={st}, run_id={run_id}, time={elapsed:.2f}s")
    results.append(("Backend /pi/strategize", ok, f"run_id: {run_id}, duration: {elapsed:.2f}s"))

    # 8. PI Explain & PI Tournament & PI Approve (if strategize succeeded)
    if run_id:
        print(f"[8/10] Testing PI Explain (/pi/explain) for run_id={run_id}...")
        st_exp, res_exp = post(f"{BACKEND_URL}/pi/explain", {"run_id": run_id})
        ok_exp = (st_exp == 200 and isinstance(res_exp, dict) and res_exp.get('success') is True)
        print(f"      Result: status={st_exp}, success={ok_exp}")
        results.append(("Backend /pi/explain", ok_exp, f"Status: {st_exp}"))

        print(f"[9/10] Testing PI Approve (/pi/approve) for run_id={run_id}...")
        st_app, res_app = post(f"{BACKEND_URL}/pi/approve", {
            "run_id": run_id,
            "strategy_id": "STRAT-A"
        })
        ok_app = (st_app == 200 and isinstance(res_app, dict) and res_app.get('success') is True)
        print(f"      Result: status={st_app}, success={ok_app}")
        results.append(("Backend /pi/approve", ok_app, f"Status: {st_app}"))
    else:
        results.append(("Backend /pi/explain", False, "Skipped due to no run_id"))
        results.append(("Backend /pi/approve", False, "Skipped due to no run_id"))

    # 10. Frontend Verification
    print("[10/10] Testing Next.js Frontend Server (http://localhost:3000)...")
    st_fe, res_fe = get(f"{FRONTEND_URL}/")
    ok_fe = (st_fe == 200)
    print(f"      Result: status={st_fe}")
    results.append(("Frontend Next.js (Port 3000)", ok_fe, f"Status: {st_fe}"))

    print("\n==================================================")
    print("                    TEST SUMMARY                  ")
    print("==================================================")
    all_ok = True
    for name, ok_flag, detail in results:
        status_str = "PASS" if ok_flag else "FAIL"
        if not ok_flag:
            all_ok = False
        print(f"[{status_str:4}] {name:<32} : {detail}")
    
    print("\n--------------------------------------------------")
    print(f"  OVERALL SYSTEM VERIFICATION: {'PASSED ALL TESTS' if all_ok else 'FEW CHECKS FAILED'}")
    print("--------------------------------------------------\n")

if __name__ == "__main__":
    run_tests()
