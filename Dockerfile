# ── Stage 1: Build Next.js static export ──
FROM node:20-alpine AS frontend-build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src/ src/
COPY tsconfig.json tailwind.config.js postcss.config.js next.config.js ./
RUN npm run build
# output: /app/out/

# ── Stage 2: Python API + static files ──
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY python/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python source
COPY python/ ./python/

# Copy Next.js static build from stage 1
COPY --from=frontend-build /app/out ./out/

# Set environment
ENV ATTENTION_LEDGER_STATIC_DIR=/app/out
ENV ATTENTION_LEDGER_TASKS_DIR=/app/python/tasks
ENV ATTENTION_LEDGER_DB_PATH=/app/data/ledger.db

# Persist DB
VOLUME /app/data

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "attention_ledger.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
