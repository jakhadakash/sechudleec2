from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path

_HERE = Path(__file__).parent
# Accept .env from backend/ or from project root — whichever exists first
_env_file = next((str(p) for p in [_HERE / ".env", _HERE.parent / ".env"] if p.exists()), ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_env_file, env_file_encoding="utf-8")

    AWS_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    EC2_INSTANCE_ID: str
    GITLAB_HOST: str
    SSH_KEY_PATH: str = "/home/ubuntu/.ssh/id_rsa"
    DASHBOARD_API_KEY: str
    SNS_TOPIC_ARN: str = ""
    EVENTBRIDGE_RULE_STOP: str = "gitlab-ec2-stop-weekday"
    EVENTBRIDGE_RULE_START: str = "gitlab-ec2-start-weekday"
    EVENTBRIDGE_RULE_WEEKEND_STOP: str = "gitlab-ec2-stop-weekend"
    EVENTBRIDGE_RULE_WEEKEND_START: str = "gitlab-ec2-start-weekend"
    LAMBDA_START_ARN: str = ""
    LAMBDA_STOP_ARN: str = ""
    SSL_DOMAINS: str = ""

    @property
    def ssl_domain_list(self) -> list[str]:
        return [d.strip() for d in self.SSL_DOMAINS.split(",") if d.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
