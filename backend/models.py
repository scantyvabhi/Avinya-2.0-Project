"""Pydantic models for Predictive Maintenance SaaS."""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- USER / AUTH ----------
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: str = "factory_owner"  # factory_owner | technician
    organization_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    full_name: str
    role: str
    organization_id: Optional[str] = None
    created_at: datetime


# ---------- HIERARCHY ----------
class FactoryCreate(BaseModel):
    name: str
    location: Optional[str] = None
    description: Optional[str] = None


class Factory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    name: str
    location: Optional[str] = None
    description: Optional[str] = None
    organization_id: str
    created_at: datetime = Field(default_factory=_now)


class BuildingCreate(BaseModel):
    name: str
    factory_id: str


class FloorCreate(BaseModel):
    name: str
    building_id: str


class ZoneCreate(BaseModel):
    name: str
    floor_id: str


# ---------- MACHINE ----------
class MachineCreate(BaseModel):
    name: str
    machine_type: str  # cnc_lathe | pump | compressor | conveyor | hvac_chiller | generic
    category: Optional[str] = "production"
    usage_type: Optional[str] = "continuous"
    factory_id: str
    zone_id: Optional[str] = None
    installation_date: Optional[str] = None
    maintenance_interval_days: int = 90


class Machine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    name: str
    machine_type: str
    category: str = "production"
    usage_type: str = "continuous"
    factory_id: str
    zone_id: Optional[str] = None
    organization_id: str
    installation_date: Optional[str] = None
    maintenance_interval_days: int = 90
    status: str = "healthy"  # healthy | warning | critical | offline
    health_score: float = 100.0
    rul_days: int = 365  # remaining useful life estimate
    twin_image_url: Optional[str] = None  # custom digital-twin background
    last_maintenance: Optional[datetime] = None
    created_at: datetime = Field(default_factory=_now)


# ---------- SENSOR ----------
class SensorReading(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    machine_id: str
    organization_id: str
    timestamp: datetime = Field(default_factory=_now)
    temperature: float
    vibration: float
    current: float
    rpm: float
    voltage: float
    humidity: float
    oil_level: float
    noise: float
    pressure: float
    power_consumption: float
    health_score: float
    status: str


class SensorIngest(BaseModel):
    machine_id: str
    temperature: float
    vibration: float
    current: float
    rpm: float
    voltage: float
    humidity: float
    oil_level: float
    noise: float
    pressure: float
    power_consumption: float


# ---------- ALERT ----------
class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    machine_id: str
    machine_name: str
    organization_id: str
    severity: str  # info | warning | critical
    category: str  # overheating, vibration_spike, lubrication, overload, etc.
    title: str
    message: str
    triggered_by: List[str] = []
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=_now)


# ---------- MAINTENANCE ----------
class MaintenanceCreate(BaseModel):
    machine_id: str
    title: str
    description: Optional[str] = None
    scheduled_for: Optional[str] = None
    priority: str = "medium"  # low | medium | high
    assigned_to: Optional[str] = None


class MaintenanceTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    machine_id: str
    machine_name: str
    organization_id: str
    title: str
    description: Optional[str] = None
    status: str = "scheduled"  # scheduled | in_progress | completed | cancelled
    priority: str = "medium"
    scheduled_for: Optional[str] = None
    assigned_to: Optional[str] = None
    created_by: str
    started_at: Optional[datetime] = None
    completion_notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)


# ---------- DIAGNOSTIC ----------
class DiagnosticResponse(BaseModel):
    machine_id: str
    health_score: float
    status: str
    rul_days: int
    anomalies: List[Dict[str, Any]]
    root_cause: str
    recommendations: List[str]
    safety_instructions: List[str]
    failure_probability: float
    generated_at: datetime
    ai_powered: bool
