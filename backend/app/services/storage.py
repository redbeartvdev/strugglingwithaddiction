import uuid
from io import BytesIO
from pathlib import Path

from app.config import get_settings

settings = get_settings()

# Register AVIF codec when the optional plugin is installed.
try:
    import pillow_avif  # noqa: F401
except ImportError:
    pillow_avif = None


def _local_upload_dir() -> Path:
    path = Path(settings.upload_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_public_url(key: str) -> str:
    if settings.s3_configured and settings.s3_public_url:
        return f"{settings.s3_public_url.rstrip('/')}/{key}"
    return f"/uploads/{key}"


def convert_image_to_avif(content: bytes, *, quality: int = 55) -> tuple[bytes, str, str]:
    """Convert image bytes to AVIF. Falls back to WebP, then original on failure.

    Returns (bytes, filename_ext_with_dot, content_type).
    """
    try:
        from PIL import Image
    except ImportError:
        return content, ".bin", "application/octet-stream"

    try:
        img = Image.open(BytesIO(content))
        img.load()
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.getbands() else "RGB")

        out = BytesIO()
        save_kwargs = {"quality": quality}
        # Prefer AVIF; WebP is the portable fallback if the codec is unavailable.
        for fmt, ext, ctype, extra in (
            ("AVIF", ".avif", "image/avif", {"speed": 6}),
            ("WEBP", ".webp", "image/webp", {"method": 4}),
        ):
            try:
                buf = BytesIO()
                img.save(buf, format=fmt, **save_kwargs, **extra)
                data = buf.getvalue()
                if data:
                    return data, ext, ctype
            except Exception:
                continue

        # Last resort: re-encode as JPEG so we still normalize the upload.
        if img.mode == "RGBA":
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")
        img.save(out, format="JPEG", quality=85, optimize=True)
        return out.getvalue(), ".jpg", "image/jpeg"
    except Exception:
        return content, ".bin", "application/octet-stream"


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


def upload_image_as_avif(content: bytes, filename: str = "image.jpg") -> str:
    """Normalize listing images to AVIF (or WebP/JPEG fallback) before storage."""
    converted, ext, content_type = convert_image_to_avif(content)
    # If conversion failed entirely, keep the original extension.
    if ext == ".bin":
        ext = Path(filename).suffix or ".bin"
        content_type = "application/octet-stream"
        converted = content
    return upload_file(converted, f"image{ext}", content_type)


def resolve_image_url(key: str | None, legacy_path: str | None = None) -> str | None:
    if key:
        if key.startswith("/"):
            return key
        return get_public_url(key)
    return legacy_path
