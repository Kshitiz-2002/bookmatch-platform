# recs-service/infra/Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN apt-get update && apt-get install -y build-essential gcc libatlas-base-dev gfortran \
    && pip install --upgrade pip \
    && pip install -r requirements.txt \
    && apt-get remove -y build-essential gcc gfortran \
    && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY . .

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "recs.main:app", "--host", "0.0.0.0", "--port", "8001"]
