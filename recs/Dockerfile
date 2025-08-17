FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# system deps for scikit-learn/pandas
RUN apt-get update && apt-get install -y build-essential gcc libpq-dev

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
