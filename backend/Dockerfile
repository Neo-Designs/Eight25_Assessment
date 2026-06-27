# --- Stage 1: Builder ---
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Install Playwright and chromium browser
RUN pip install --no-cache-dir --user playwright && \
    python -m playwright install chromium

# --- Stage 2: Runtime ---
FROM python:3.11-slim

WORKDIR /app

# System dependencies for Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 libx11-xcb1 \
    libxcursor1 libxi6 libxtst6 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

ENV PATH=/root/.local/bin:$PATH
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# App code + bundled prompts/
COPY . .

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]