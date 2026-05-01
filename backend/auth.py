from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt, ExpiredSignatureError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from backend.models import TokenData
import os

# -----------------------------
# CONFIG
# -----------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key_change_in_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# -----------------------------
# PASSWORD HASHING
# -----------------------------
# Prefer pbkdf2_sha256 because it works reliably in this environment.
# Keep bcrypt verification enabled so older seeded/users records still work.
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    deprecated="auto",
)

# Swagger login endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")


# -----------------------------
# PASSWORD HELPERS
# -----------------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False  # prevents crash if hash is corrupted


# -----------------------------
# JWT FUNCTIONS
# -----------------------------
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()

    now = datetime.now(timezone.utc)

    expire = now + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({
        "exp": expire,
        "iat": now
    })

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[TokenData]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        username: str = payload.get("sub")
        role: str = payload.get("role")

        if not username:
            return None

        return TokenData(username=username, role=role)

    except ExpiredSignatureError:
        return None  # token expired

    except JWTError:
        return None  # invalid token


# -----------------------------
# CURRENT USER
# -----------------------------
def get_current_user(token: str = Depends(oauth2_scheme)):

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = decode_access_token(token)

    if token_data is None:
        raise credentials_exception

    return token_data


# -----------------------------
# ROLE-BASED ACCESS
# -----------------------------
def require_role(required_role: str):

    def role_checker(current_user: TokenData = Depends(get_current_user)):

        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {required_role}"
            )

        return current_user

    return role_checker
