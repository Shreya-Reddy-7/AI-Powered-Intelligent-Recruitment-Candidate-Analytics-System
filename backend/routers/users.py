from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from backend.database import get_users_db, init_users_db
from backend.models import UserRegister, UserResponse, Token
from backend.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from datetime import timedelta

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

ACCESS_TOKEN_EXPIRE_MINUTES = 30


# -----------------------------
# REGISTER
# -----------------------------
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserRegister):

    init_users_db()
    conn = get_users_db()
    cursor = conn.cursor()

    try:
        # -----------------------------
        # CHECK USERNAME
        # -----------------------------
        cursor.execute("SELECT 1 FROM users WHERE username=?", (user.username,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )

        # -----------------------------
        # CHECK EMAIL
        # -----------------------------
        cursor.execute("SELECT 1 FROM users WHERE email=?", (user.email,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # -----------------------------
        # ROLE VALIDATION
        # -----------------------------
        if user.role not in ["candidate", "recruiter"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be 'candidate' or 'recruiter'"
            )

        # -----------------------------
        # HASH PASSWORD
        # -----------------------------
        hashed_password = hash_password(user.password)

        # -----------------------------
        # INSERT USER
        # -----------------------------
        cursor.execute("""
        INSERT INTO users (username, email, hashed_password, role)
        VALUES (?, ?, ?, ?)
        """, (
            user.username,
            user.email,
            hashed_password,
            user.role
        ))

        conn.commit()
        user_id = cursor.lastrowid

        return UserResponse(
            id=user_id,
            username=user.username,
            email=user.email,
            role=user.role
        )

    finally:
        conn.close()


# -----------------------------
# LOGIN
# -----------------------------
@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):

    conn = get_users_db()
    cursor = conn.cursor()

    try:
        # -----------------------------
        # FETCH USER
        # -----------------------------
        cursor.execute(
            "SELECT * FROM users WHERE username=? OR email=?",
            (form_data.username, form_data.username)
        )
        user = cursor.fetchone()

        # -----------------------------
        # VALIDATE
        # -----------------------------
        if not user or not verify_password(form_data.password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username/email or password"
            )

        # -----------------------------
        # CREATE TOKEN
        # -----------------------------
        access_token = create_access_token(
            data={
                "sub": user["username"],
                "role": user["role"]
            },
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )

        return Token(
            access_token=access_token,
            token_type="bearer"
        )

    finally:
        conn.close()


# -----------------------------
# GET CURRENT USER
# -----------------------------
@router.get("/me", response_model=UserResponse)
def get_me(current_user=Depends(get_current_user)):

    conn = get_users_db()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT * FROM users WHERE username=?",
            (current_user.username,)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return UserResponse(
            id=user["id"],
            username=user["username"],
            email=user["email"],
            role=user["role"]
        )

    finally:
        conn.close()