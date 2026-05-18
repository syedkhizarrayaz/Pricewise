FROM node:20-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

# Python runtime + build tools for scientific deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ---------- Python service dependencies ----------
COPY services/requirements.txt /app/services/requirements.txt
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
RUN pip install --upgrade pip setuptools wheel && pip install -r /app/services/requirements.txt

# ---------- Node backend dependencies ----------
COPY backend/package*.json /app/backend/
RUN cd /app/backend && npm ci

# ---------- App source ----------
COPY backend /app/backend
COPY services /app/services
COPY deployment/huggingface/start.sh /app/start.sh

# Build TS backend
RUN cd /app/backend && npm run build

RUN chmod +x /app/start.sh

# Hugging Face Spaces expects the app on 7860
ENV PORT=7860
ENV PYTHON_SERVICE_URL=http://127.0.0.1:8000
ENV ENABLE_DATABASE=false
EXPOSE 7860

CMD ["/app/start.sh"]
