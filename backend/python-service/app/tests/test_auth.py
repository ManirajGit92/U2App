from app.core.config import Settings
from app.core.security import create_access_token


def test_create_access_token() -> None:
    settings = Settings(jwt_secret_key="test-secret", admin_password="secret")
    token = create_access_token("admin", settings)
    assert isinstance(token, str)
    assert token
