import ssl
import socket
from datetime import datetime, timezone
from backend.config import settings


def get_ssl_expiry(hostname: str, port: int = 443) -> dict:
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.socket(), server_hostname=hostname) as s:
            s.settimeout(5)
            s.connect((hostname, port))
            cert = s.getpeercert()
        expiry = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(
            tzinfo=timezone.utc
        )
        days_left = (expiry - datetime.now(timezone.utc)).days
        return {
            "domain": hostname,
            "expiry_date": expiry.isoformat(),
            "days_remaining": days_left,
            "status": (
                "critical" if days_left < 14 else "warning" if days_left < 30 else "ok"
            ),
            "error": None,
        }
    except Exception as e:
        return {
            "domain": hostname,
            "expiry_date": None,
            "days_remaining": None,
            "status": "error",
            "error": str(e),
        }


def check_all_domains() -> list[dict]:
    domains = settings.ssl_domain_list
    return [get_ssl_expiry(d) for d in domains]
