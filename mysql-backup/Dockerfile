FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    default-mysql-client \
    cron \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backup.sh /app/
COPY entrypoint.sh /app/
COPY send_mail.py /app/
COPY requirements.txt /app/
COPY .env /app/

RUN pip install --no-cache-dir -r requirements.txt

RUN sed -i 's/\r$//' /app/*.sh && chmod +x /app/backup.sh /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
