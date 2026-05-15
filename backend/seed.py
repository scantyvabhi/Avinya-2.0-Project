"""Seed demo organization, user, factory and machines."""
import os
from datetime import datetime, timezone
from auth import hash_password

DEMO_EMAIL = "demo@predmaint.io"
DEMO_PASSWORD = "Demo@1234"
TECH_EMAIL = "tech@predmaint.io"
TECH_PASSWORD = "Tech@1234"

SAMPLE_MACHINES = [
    {"name": "CNC Lathe #1",         "machine_type": "cnc_lathe"},
    {"name": "Industrial Pump #1",   "machine_type": "pump"},
    {"name": "Air Compressor #1",    "machine_type": "compressor"},
    {"name": "Conveyor Belt #1",     "machine_type": "conveyor"},
    {"name": "HVAC Chiller #1",      "machine_type": "hvac_chiller"},
]


async def seed_demo_data(db):
    """Idempotent demo seed."""
    existing = await db.users.find_one({"email": DEMO_EMAIL}, {"_id": 0})
    if existing:
        print(f"[seed] demo user already exists: {DEMO_EMAIL}")
        return

    now = datetime.now(timezone.utc).isoformat()
    org_id = "org-demo-001"
    user_id = "user-demo-001"
    factory_id = "factory-demo-001"

    # Org
    await db.organizations.insert_one({
        "id": org_id,
        "name": "Demo Manufacturing Co.",
        "created_at": now,
    })

    # User (factory owner)
    await db.users.insert_one({
        "id": user_id,
        "email": DEMO_EMAIL,
        "password_hash": hash_password(DEMO_PASSWORD),
        "full_name": "Demo Owner",
        "role": "factory_owner",
        "organization_id": org_id,
        "created_at": now,
    })

    # Technician user
    await db.users.insert_one({
        "id": "user-tech-001",
        "email": TECH_EMAIL,
        "password_hash": hash_password(TECH_PASSWORD),
        "full_name": "Demo Technician",
        "role": "technician",
        "organization_id": org_id,
        "created_at": now,
    })

    # Factory
    await db.factories.insert_one({
        "id": factory_id,
        "name": "Plant A — Mumbai",
        "location": "Mumbai, India",
        "description": "Primary production facility",
        "organization_id": org_id,
        "created_at": now,
    })

    # Building / floor / zone
    building_id = "building-demo-001"
    floor_id = "floor-demo-001"
    zone_id = "zone-demo-001"
    await db.buildings.insert_one({
        "id": building_id, "name": "Building 1", "factory_id": factory_id,
        "organization_id": org_id, "created_at": now,
    })
    await db.floors.insert_one({
        "id": floor_id, "name": "Ground Floor", "building_id": building_id,
        "organization_id": org_id, "created_at": now,
    })
    await db.zones.insert_one({
        "id": zone_id, "name": "Production Zone A", "floor_id": floor_id,
        "organization_id": org_id, "created_at": now,
    })

    # Machines
    for i, m in enumerate(SAMPLE_MACHINES, start=1):
        await db.machines.insert_one({
            "id": f"machine-demo-{i:03d}",
            "name": m["name"],
            "machine_type": m["machine_type"],
            "category": "production",
            "usage_type": "continuous",
            "factory_id": factory_id,
            "zone_id": zone_id,
            "organization_id": org_id,
            "installation_date": "2023-01-15",
            "maintenance_interval_days": 90,
            "status": "healthy",
            "health_score": 100.0,
            "rul_days": 365,
            "last_maintenance": None,
            "created_at": now,
        })

    print("[seed] demo data created.")
    print(f"[seed]   Owner:      {DEMO_EMAIL} / {DEMO_PASSWORD}")
    print(f"[seed]   Technician: {TECH_EMAIL}  / {TECH_PASSWORD}")
