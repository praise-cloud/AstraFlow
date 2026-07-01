from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from backend.db.database import get_db
from backend.models.push_token import PushToken
from backend.models.price_alert import PriceAlert
from backend.models.user import User
from backend.routes.dashboard import get_current_user

import httpx

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class RegisterTokenBody(BaseModel):
    token: str
    platform: str = "expo"


class AlertBody(BaseModel):
    title: str
    body: str
    data: Optional[dict] = None


class PreferencesBody(BaseModel):
    min_change_pct: Optional[float] = None
    alert_on_petrol: Optional[bool] = None
    alert_on_diesel: Optional[bool] = None
    alerts_enabled: Optional[bool] = None


@router.post("/register")
def register_token(
    body: RegisterTokenBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(PushToken)
        .filter(PushToken.user_id == user.id, PushToken.token == body.token)
        .first()
    )
    if existing:
        existing.alerts_enabled = True
    else:
        pt = PushToken(user_id=user.id, token=body.token, platform=body.platform)
        db.add(pt)
    db.commit()
    return {"message": "Token registered"}


@router.delete("/register")
def unregister_token(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(PushToken).filter(PushToken.user_id == user.id).delete()
    db.commit()
    return {"message": "Token unregistered"}


@router.post("/alert")
def send_alert(
    body: AlertBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tokens = (
        db.query(PushToken)
        .filter(PushToken.user_id == user.id, PushToken.alerts_enabled == True)
        .all()
    )
    if not tokens:
        raise HTTPException(status_code=404, detail="No push tokens registered")

    messages = []
    for pt in tokens:
        messages.append({
            "to": pt.token,
            "title": body.title,
            "body": body.body,
            "data": body.data or {},
            "sound": "default",
        })

    try:
        resp = httpx.post(EXPO_PUSH_URL, json=messages, timeout=10)
        resp.raise_for_status()
        return {"message": "Alert sent", "receipts": resp.json().get("data", [])}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Expo push failed: {str(e)}")


@router.get("/preferences")
def get_preferences(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    token = (
        db.query(PushToken)
        .filter(PushToken.user_id == user.id)
        .first()
    )
    return {
        "push_enabled": token is not None,
        "alerts_enabled": token.alerts_enabled if token else False,
        "min_change_pct": token.min_change_pct if token else 2.0,
        "alert_on_petrol": token.alert_on_petrol if token else True,
        "alert_on_diesel": token.alert_on_diesel if token else True,
    }


@router.patch("/preferences")
def update_preferences(
    body: PreferencesBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    token = (
        db.query(PushToken)
        .filter(PushToken.user_id == user.id)
        .first()
    )
    if not token:
        raise HTTPException(status_code=404, detail="No push token registered")
    if body.min_change_pct is not None:
        token.min_change_pct = body.min_change_pct
    if body.alert_on_petrol is not None:
        token.alert_on_petrol = body.alert_on_petrol
    if body.alert_on_diesel is not None:
        token.alert_on_diesel = body.alert_on_diesel
    if body.alerts_enabled is not None:
        token.alerts_enabled = body.alerts_enabled
    db.commit()
    return {"message": "Preferences updated"}
