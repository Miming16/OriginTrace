from fastapi import Header, HTTPException
import jwt

from .config import JWT_SECRET


def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return jwt.decode(authorization[7:], JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from error


def require_submission_role(user: dict) -> dict:
    if user.get("role") not in {"instructor", "student"}:
        raise HTTPException(status_code=403, detail="Instructor or student role required")
    return user