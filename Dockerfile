# ── Stage 1: Build Next.js static export ──
FROM node:20-alpine AS frontend-build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src/ src/
COPY public/ public/
COPY tsconfig.json tailwind.config.js postcss.config.js next.config.js ./
RUN npm run build
# output: /app/out/

# ── Stage 2: Python API + static files ──
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY python/requirements.txt python/requirements.lock python/requirements-audio-ai.txt ./
RUN pip install --no-cache-dir -r requirements.lock
ARG INSTALL_AUDIO_AI=false
RUN if [ "$INSTALL_AUDIO_AI" = "true" ]; then pip install --no-cache-dir -r requirements-audio-ai.txt; fi

# Copy Python source
COPY python/ ./python/

# Copy Next.js static build from stage 1
COPY --from=frontend-build /app/out ./out/

# Set environment
ENV PYTHONPATH=/app/python
ENV ATTENTION_LEDGER_STATIC_DIR=/app/out
ENV ATTENTION_LEDGER_TASKS_DIR=/app/python/tasks
ENV ATTENTION_LEDGER_DB_PATH=/app/data/ledger.db
ENV PYANNOTE_METRICS_ENABLED=0

# Ensure data directory exists
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "attention_ledger.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
