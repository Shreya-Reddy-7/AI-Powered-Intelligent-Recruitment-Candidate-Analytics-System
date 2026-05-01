from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=3)
    role: str = Field(default="candidate", pattern="^(candidate|recruiter)$")


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class ResumeResponse(BaseModel):
    resume_id: int
    skills: List[str] = Field(default_factory=list)
    education: List[str] = Field(default_factory=list)
    experience_years: int = 0


class JobCreate(BaseModel):
    job_title: str = Field(..., min_length=3)
    job_description: str = Field(..., min_length=10)
    experience_required: str = Field(..., examples=["2 years"])


class JobResponse(BaseModel):
    job_id: int
    job_title: str
    mandatory_skills: List[str] = Field(default_factory=list)
    optional_skills: List[str] = Field(default_factory=list)
    experience_required: str


class JobApplication(BaseModel):
    job_id: int
    resume_id: int
    application_date: str
    status: str = "pending"


class JobApplicationResponse(BaseModel):
    application_id: int
    job_id: int
    job_title: str
    resume_id: int
    application_date: str
    status: Literal["pending", "shortlisted", "rejected"]


class AnalysisModel(BaseModel):
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)
    score: Optional[float] = 0
    summary: str = ""
    verdict: Optional[str] = None
    selection_reason: Optional[str] = None
    ranking_reason: Optional[str] = None


class RankingResult(BaseModel):
    resume_id: int
    username: Optional[str] = None
    experience_years: Optional[int] = None
    score: float
    skill_score: float
    experience_score: float
    education_score: float
    matched_skills: List[str] = Field(default_factory=list)
    badge: Optional[str] = None
    match_percentage: Optional[float] = None
    analysis: Optional[AnalysisModel] = None


class RankingResponse(BaseModel):
    job_id: int
    job_title: str
    total_candidates: int
    rankings: List[RankingResult]
    top_insight: Optional[dict] = None
