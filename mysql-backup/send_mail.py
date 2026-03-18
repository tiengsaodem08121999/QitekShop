import smtplib
import sys
import os
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv("/app/.env")

status=sys.argv[1]
file=sys.argv[2]
size=sys.argv[3]
time=sys.argv[4]

msg=EmailMessage()

msg["Subject"]=f"MySQL Backup {status}"
msg["From"]=os.getenv("EMAIL_FROM")
msg["To"]=os.getenv("EMAIL_TO")

msg.set_content(f"""
MySQL Backup Report

Status : {status}

Database : {os.getenv("DB_NAME")}

Backup Time : {time}

Backup File : {file}

File Size : {size}

Server : {os.getenv("DB_HOST")}
""")

server=smtplib.SMTP_SSL(
    os.getenv("SMTP_SERVER"),
    int(os.getenv("SMTP_PORT"))
)

server.login(
    os.getenv("EMAIL_FROM"),
    os.getenv("EMAIL_PASSWORD")
)

server.send_message(msg)

server.quit()