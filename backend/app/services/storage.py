import uuid
from pathlib import Path

from app.config import get_settings

settings = get_settings()


def _local_upload_dir() -> Path:
    path = Path(settings.upload_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_public_url(key: str) -> str:
    if settings.s3_configured and settings.s3_public_url:
        return f"{settings.s3_public_url.rstrip('/')}/{key}"
    return f"/uploads/{key}"


def upload_file(content: bytes, filename: str, content_type: str = "application/octet-stream") -> str:
    ext = Path(filename).suffix or ".bin"
    key = f"{uuid.uuid4().hex}{ext}"

    if settings.s3_configured:
        import boto3

        client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )
        client.put_object(
            Bucket=settings.s3_bucket_name,
            Key=key,
            Body=content,
            ContentType=content_type,
        )
        return key

    dest = _local_upload_dir() / key
    dest.write_bytes(content)
    return key


def resolve_image_url(key: str | None, legacy_path: str | None = None) -> str | None:
    if key:
        if key.startswith("/"):
            return key
        return get_public_url(key)
    return legacy_path
