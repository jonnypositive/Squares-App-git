#!/usr/bin/env python3
import json
import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


def load_env_file(path: str = ".env") -> None:
    if not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


def parse_bool(value: str, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def send_bulk_email(recipients: list[str], subject: str, body: str) -> None:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    use_tls = parse_bool(os.getenv("SMTP_USE_TLS"), True)
    use_ssl = parse_bool(os.getenv("SMTP_USE_SSL"), False)

    from_email = os.getenv("EMAIL_FROM")
    from_name = os.getenv("EMAIL_FROM_NAME", "Football Squares by Jonny+")
    reply_to = os.getenv("EMAIL_REPLY_TO", "")

    if not smtp_host:
        raise ValueError("SMTP_HOST is not configured.")
    if not from_email:
        raise ValueError("EMAIL_FROM is not configured.")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((from_name, from_email))
    message["To"] = from_email
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(body)

    if use_ssl:
        smtp = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20)
    else:
        smtp = smtplib.SMTP(smtp_host, smtp_port, timeout=20)

    with smtp:
        smtp.ehlo()
        if use_tls and not use_ssl:
            smtp.starttls()
            smtp.ehlo()
        if smtp_username:
            smtp.login(smtp_username, smtp_password)
        smtp.send_message(message, from_addr=from_email, to_addrs=recipients)


class AppHandler(SimpleHTTPRequestHandler):
    def send_json(self, status_code: int, payload: dict) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self) -> None:
        if self.path != "/api/send-bulk-email":
            self.send_json(404, {"error": "Not found."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            payload = json.loads(raw_body.decode("utf-8"))
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Invalid JSON request body."})
            return

        recipients = payload.get("recipients")
        subject = (payload.get("subject") or "").strip()
        body = (payload.get("body") or "").strip()

        if not isinstance(recipients, list) or not recipients:
            self.send_json(400, {"error": "At least one recipient email is required."})
            return

        clean_recipients = []
        for recipient in recipients:
            if not isinstance(recipient, str):
                continue
            email = recipient.strip()
            if "@" in email and "." in email:
                clean_recipients.append(email)

        clean_recipients = sorted(set(clean_recipients))

        if not clean_recipients:
            self.send_json(400, {"error": "No valid recipient emails found."})
            return

        if not subject:
            self.send_json(400, {"error": "Email subject is required."})
            return

        if not body:
            self.send_json(400, {"error": "Email message body is required."})
            return

        try:
            send_bulk_email(clean_recipients, subject, body)
        except Exception as exc:  # noqa: BLE001
            self.send_json(500, {"error": f"Email send failed: {exc}"})
            return

        self.send_json(200, {"ok": True, "sent": len(clean_recipients)})


def main() -> None:
    load_env_file()
    host = os.getenv("APP_HOST", "127.0.0.1")
    port = int(os.getenv("APP_PORT", "8080"))

    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Football Squares server running at http://{host}:{port}")
    print("Use Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
