"""Accounts: register, login, settings, and the current-user dependencies (Release 2)."""
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Graph, User
from ..schemas import ChangePasswordIn, LoginIn, RegisterIn, TokenOut, UserOut
from ..security import create_token, hash_password, verify_password, verify_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _valid_email(email: str) -> bool:
    # Deliberately light: one @, a dot in the domain, no spaces. Avoids an extra dep.
    if email.count("@") != 1 or " " in email:
        return False
    local, _, domain = email.partition("@")
    return bool(local) and "." in domain and not domain.startswith(".") and not domain.endswith(".")


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    """Resolve the bearer token to a user, or None if absent/invalid — never raises.
    A token whose version is behind the user's current token_version is treated as
    revoked (e.g. after a password change or "log out everywhere")."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    claim = verify_token(authorization[7:].strip())
    if claim is None:
        return None
    user_id, version = claim
    user = db.get(User, user_id)
    if user is None or user.token_version != version:
        return None
    return user


def get_current_user(user: User | None = Depends(get_optional_user)) -> User:
    """Require a valid session; 401 otherwise."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.post("/register", response_model=TokenOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    if not _valid_email(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    user = User(id=uuid.uuid4().hex[:12], email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_token(user.id, user.token_version), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    # Same error whether the email is unknown or the password is wrong (no user enumeration).
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return TokenOut(access_token=create_token(user.id, user.token_version), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password", response_model=TokenOut)
def change_password(
    payload: ChangePasswordIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Your current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    # Revoke every existing token, then hand the caller a fresh one so this session stays in.
    user.token_version += 1
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_token(user.id, user.token_version), user=UserOut.model_validate(user))


@router.post("/logout-all", status_code=204)
def logout_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Revoke every outstanding token for this account (including the caller's)."""
    user.token_version += 1
    db.commit()
    return Response(status_code=204)


@router.delete("/me", status_code=204)
def delete_account(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Delete the account and everything it owns. Anonymous graphs are left untouched."""
    db.query(Graph).filter(Graph.owner_id == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    return Response(status_code=204)
