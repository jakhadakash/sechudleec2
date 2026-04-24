import paramiko
from backend.config import settings
from backend.services import ec2_service


def get_disk_usage() -> dict:
    # Only check disk if instance is running
    try:
        status = ec2_service.get_instance_status()
        if status["state"] != "running":
            return {
                "total_gb": None,
                "used_gb": None,
                "available_gb": None,
                "usage_percent": None,
                "status": "unavailable",
                "error": f"Instance is {status['state']} - disk check only available when running",
            }
    except Exception as e:
        return {
            "total_gb": None,
            "used_gb": None,
            "available_gb": None,
            "usage_percent": None,
            "status": "error",
            "error": f"Cannot check instance state: {str(e)}",
        }
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            settings.GITLAB_HOST,
            username="ubuntu",
            key_filename=settings.SSH_KEY_PATH,
            timeout=10,
        )
        _, stdout, stderr = ssh.exec_command(
            "df -BG /var/opt/gitlab --output=size,used,avail,pcent 2>/dev/null | tail -1"
        )
        line = stdout.read().decode().split()
        ssh.close()

        if len(line) < 4:
            raise ValueError("Unexpected df output")

        total = int(line[0].replace("G", ""))
        used = int(line[1].replace("G", ""))
        avail = int(line[2].replace("G", ""))
        pct = int(line[3].replace("%", ""))

        return {
            "total_gb": total,
            "used_gb": used,
            "available_gb": avail,
            "usage_percent": pct,
            "status": (
                "critical" if pct > 85 else "warning" if pct > 70 else "ok"
            ),
            "error": None,
        }
    except Exception as e:
        return {
            "total_gb": None,
            "used_gb": None,
            "available_gb": None,
            "usage_percent": None,
            "status": "error",
            "error": str(e),
        }
