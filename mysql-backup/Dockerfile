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

RUN chmod +x /app/backup.sh
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
