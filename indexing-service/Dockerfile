# Use Python 3.12 instead of 3.13
FROM python:3.12-slim

# Set environment variables
ENV PYTHONUNBUFFERED=True \
    APP_HOME=/app \
    PORT=8080 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR $APP_HOME

# Install system dependencies required by 'textract'
RUN apt-get update && apt-get install -y --no-install-recommends \
    antiword \
    libxml2-utils \
    xsltproc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies (without cache mount)
RUN uv sync --frozen --no-dev

# Copy application code
COPY . .

# Set PATH to include virtual environment
ENV PATH="/app/.venv/bin:$PATH"

# Run the application
CMD ["functions-framework", "--target=process_resume", "--port=8080"]
