FROM python:3.11-slim

# Install system dependencies needed for Playwright and general builds
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and its system dependencies for Chromium only (saves space)
RUN playwright install --with-deps chromium

# Copy app code
COPY . .

# Expose port
EXPOSE 8000

# Run FastAPI app
CMD ["python", "run.py"]
