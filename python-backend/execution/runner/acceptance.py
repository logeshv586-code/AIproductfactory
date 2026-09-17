"""Protected evaluator in a separate container. Reads server-owned criteria."""
import base64
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

base, contract_file = sys.argv[1:3]
contract = json.loads(Path(contract_file).read_text())
results = []


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = urllib.request.build_opener(NoRedirect)


def request(path, method='GET', body=None):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body else None, method=method, headers={'Content-Type': 'application/json'})
    try:
        with opener.open(req, timeout=10) as response:
            return response.status, response.read(2_000_000)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(2_000_000)


def pointer(value, key):
    for part in key.split('/')[1:] if key else []:
        part = part.replace('~1', '/').replace('~0', '~')
        value = value[int(part)] if isinstance(value, list) else value[part]
    return value


def assertion(value, rule):
    actual = pointer(value, rule['pointer'])
    expected = rule.get('expected')
    op = rule['operator']
    if op == 'equals':
        return actual == expected
    if op == 'contains':
        return expected in actual
    if op == 'greater_than':
        return actual > expected
    return actual is not None and actual not in ('', [], {})


ready = False
for attempt in range(90):
    try:
        status, body = request('/health')
        if status == 200:
            ready = True
            break
    except Exception:
        pass
    time.sleep(1)
results.append({'name': 'runtimeReady', 'passed': ready, 'detail': 'Isolated application started' if ready else 'Application did not start within the runner budget'})
if ready:
    for check in contract['acceptance']:
        if check['kind'] == 'browser':
            continue
        try:
            if check['kind'] == 'manual':
                raise ValueError('Requires external or human validation: ' + check['description'])
            status, body = request(check['path'], check['method'], check['body'])
            assert status == check['expected_status'], f'Expected HTTP {check["expected_status"]}, received {status}'
            value = json.loads(body)
            assert all(assertion(value, r) for r in check['assertions']), 'Observed output did not satisfy the approved assertions'
            results.append({'name': check['id'], 'requirementId': check['requirement_id'], 'passed': True, 'detail': check['description']})
        except Exception as exc:
            results.append({'name': check['id'], 'requirementId': check['requirement_id'], 'passed': False, 'detail': str(exc)[:800]})
    try:
        from playwright.sync_api import sync_playwright, expect
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
            context = browser.new_context(service_workers='block', viewport={'width': 1280, 'height': 800})
            context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base + '/') else route.abort())
            for check in contract['acceptance']:
                if check['kind'] != 'browser':
                    continue
                page = context.new_page()
                page.set_default_timeout(10000)
                try:
                    page.goto(base + '/', wait_until='networkidle')
                    for step in check['steps']:
                        action, target, value = step['action'], step['target'], step.get('value', '')
                        if action == 'visit':
                            page.goto(base + target, wait_until='networkidle')
                        elif action == 'fill':
                            page.locator(target).fill(value)
                        elif action == 'click':
                            page.locator(target).click()
                        elif action == 'text':
                            expect(page.locator(target)).to_contain_text(value)
                        else:
                            expect(page.locator(target)).to_be_visible()
                    results.append({'name': check['id'], 'requirementId': check['requirement_id'], 'passed': True, 'detail': check['description']})
                except Exception as exc:
                    results.append({'name': check['id'], 'requirementId': check['requirement_id'], 'passed': False, 'detail': str(exc)[:800]})
                finally:
                    page.close()
            page = context.new_page()
            page.goto(base + '/', wait_until='networkidle')
            Path('/evidence/preview.png').write_bytes(page.screenshot(full_page=False))
            browser.close()
    except Exception as exc:
        results.append({'name': 'browserRunner', 'passed': False, 'detail': str(exc)[:800]})
print(json.dumps({'checks': results}))
