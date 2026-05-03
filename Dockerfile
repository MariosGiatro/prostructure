# ProStructure Python static + API server
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache

COPY server.py index.html app.js style.css ./

ENV PORT=8000
EXPOSE 8000

CMD ["uv", "run", "python", "-u", "server.py"]
