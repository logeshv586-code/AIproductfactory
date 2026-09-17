FROM node:22-bookworm AS node
FROM python:3.12-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
COPY python-backend/requirements.txt /opt/runner/requirements.txt
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN pip install --no-cache-dir -r /opt/runner/requirements.txt playwright==1.55.1 && playwright install --with-deps chromium && chmod -R a+rX /ms-playwright
COPY python-backend/execution/runner_web /opt/runner/web
RUN cd /opt/runner/web && npm ci --ignore-scripts && node node_modules/esbuild/install.js
COPY python-backend/execution/runner /opt/runner
RUN useradd -m -u 10001 runner
USER 10001:10001
WORKDIR /work
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NODE_PATH=/opt/runner/web/node_modules
