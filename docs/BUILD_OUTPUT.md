# Generated Build Output

A successful Product Factory build returns four inspectable outputs to the customer:

1. **Running product screen** — HTML fetched from the generated application's live `/` route after `/health` succeeds.
2. **Source browser** — generated files returned for inspection in the Studio.
3. **Verification evidence** — static, test, import and live-server checks plus repair attempt count.
4. **Full source ZIP** — the packaged workspace delivered through the Product Factory artifact API.

The runtime preview is not labeled as runtime-served when the generated server check fails.
