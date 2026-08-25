# Full Build Delivery Contract

After a customer approves a Product Factory plan, the build stage is expected to produce an inspectable runnable artifact rather than only a developer handoff prompt.

## Delivery sequence

1. Preserve the approved strategy and repository set.
2. Generate product-owned source, adapters, tests and deployment files.
3. Record approved sources and third-party notices.
4. Run syntax, JSON, secret-pattern and unfinished-placeholder checks.
5. Import the generated application.
6. Execute the generated tests.
7. Start the generated application on an isolated local port.
8. Verify `/health` and request `/` from the running server.
9. Capture the UI returned by the running application.
10. Attempt repair passes if verification fails.
11. Package the generated workspace as a ZIP.
12. Return source files, verification evidence, running preview and a ZIP download action to the Studio.

A build remains unverified while a required executable delivery gate is open. Environment-specific production validation can still be required for real external services, OS-specific automation, credentials, load, security policy and deployment infrastructure.
