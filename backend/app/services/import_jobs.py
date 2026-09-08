"""In-memory import job progress for the admin CSV / Excel uploader."""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.services.samhsa_import import import_centers_file

JOB_TTL = timedelta(hours=2)

_lock = threading.Lock()
_jobs: dict[str, ImportJob] = {}


@dataclass
class ImportJob:
    id: str
    filename: str
    status: str = "queued"
    phase: str = "queued"
    message: str = "Queued"
    processed: int = 0
    total: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    total_rows: int = 0
    percent: int = 0
    errors: list[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def snapshot(self) -> dict:
        return {
            "job_id": self.id,
            "filename": self.filename,
            "status": self.status,
            "phase": self.phase,
            "message": self.message,
            "processed": self.processed,
            "total": self.total,
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "total_rows": self.total_rows,
            "percent": self.percent,
            "errors": list(self.errors),
        }


def _purge_locked(now: datetime) -> None:
    expired = [job_id for job_id, job in _jobs.items() if now - job.updated_at > JOB_TTL]
    for job_id in expired:
        _jobs.pop(job_id, None)


def create_import_job(filename: str) -> ImportJob:
    job = ImportJob(id=uuid.uuid4().hex, filename=filename)
    now = datetime.now(timezone.utc)
    with _lock:
        _purge_locked(now)
        _jobs[job.id] = job
    return job


def get_import_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return job.snapshot() if job else None


def update_import_job(job_id: str, **fields) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        for key, value in fields.items():
            if hasattr(job, key) and value is not None:
                setattr(job, key, value)
        if job.total_rows < job.processed:
            job.total_rows = job.processed
        job.updated_at = datetime.now(timezone.utc)


def run_import_job(job_id: str, content: bytes, filename: str, publish: bool) -> None:
    def on_progress(**payload) -> None:
        update_import_job(
            job_id,
            status=payload.get("phase") if payload.get("phase") in {"reading", "importing", "saving"} else None,
            **payload,
        )

    update_import_job(job_id, status="reading", phase="reading", message="Reading file…", percent=4)
    db = SessionLocal()
    try:
        result = import_centers_file(
            db,
            content,
            filename=filename,
            publish=publish,
            on_progress=on_progress,
        )
        failed = result.total_rows == 0 and bool(result.errors)
        update_import_job(
            job_id,
            status="error" if failed else "done",
            phase="error" if failed else "done",
            message=result.errors[0] if failed else "Import complete",
            processed=result.total_rows,
            total=result.total_rows,
            created=result.created,
            updated=result.updated,
            skipped=result.skipped,
            total_rows=result.total_rows,
            percent=100,
            errors=result.errors,
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        update_import_job(
            job_id,
            status="error",
            phase="error",
            message=str(exc),
            percent=100,
            errors=[str(exc)],
        )
    finally:
        db.close()
