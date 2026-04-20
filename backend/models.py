"""
Pydantic models for request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional


# ── Auth ─────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: Optional[int] = None
    username: str
    email: str
    role: str
    scope: Optional[str] = "all"


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Users ────────────────────────────────────────────────────────────
class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "USER"
    scope: str = "all"


class UpdateUserRequest(BaseModel):
    id: int
    role: Optional[str] = None
    scope: Optional[str] = None


# ── Projects ─────────────────────────────────────────────────────────
class ProjectCreate(BaseModel):
    projectName: str = Field(alias="projectName")
    spv: str = ""
    projectType: str = Field("", alias="projectType")
    plotLocation: str = Field("", alias="plotLocation")
    plotNo: str = Field("", alias="plotNo")
    capacity: float = 0
    category: str = "Solar"
    section: str = "A"
    priority: Optional[str] = None
    fiscalYear: str = Field("FY_25-26", alias="fiscalYear")

    class Config:
        populate_by_name = True


class ProjectBulkItem(BaseModel):
    sno: int
    projectName: str = Field(alias="projectName")
    spv: str = ""
    projectType: str = Field("", alias="projectType")
    plotLocation: str = Field("", alias="plotLocation")
    capacity: Optional[float] = 0
    planActual: str = Field(alias="planActual")
    apr: Optional[float] = 0
    may: Optional[float] = 0
    jun: Optional[float] = 0
    jul: Optional[float] = 0
    aug: Optional[float] = 0
    sep: Optional[float] = 0
    oct: Optional[float] = 0
    nov: Optional[float] = 0
    dec: Optional[float] = 0
    jan: Optional[float] = 0
    feb: Optional[float] = 0
    mar: Optional[float] = 0
    totalCapacity: Optional[float] = Field(0, alias="totalCapacity")
    cummTillOct: Optional[float] = Field(0, alias="cummTillOct")
    q1: Optional[float] = 0
    q2: Optional[float] = 0
    q3: Optional[float] = 0
    q4: Optional[float] = 0
    category: str = "Solar"
    section: str = "A"
    includedInTotal: Optional[bool] = Field(True, alias="includedInTotal")

    class Config:
        populate_by_name = True


# ── Milestones ───────────────────────────────────────────────────────
class MilestoneUpdate(BaseModel):
    projectId: int = Field(alias="projectId")
    fiscalYear: str = Field(alias="fiscalYear")
    month: str
    trialRun: Optional[str] = Field(None, alias="trialRun")
    chargingDate: Optional[str] = Field(None, alias="chargingDate")
    codDate: Optional[str] = Field(None, alias="codDate")

    class Config:
        populate_by_name = True


# ── Clone FY ─────────────────────────────────────────────────────────
class CloneFYRequest(BaseModel):
    fromFY: str
    toFY: str
