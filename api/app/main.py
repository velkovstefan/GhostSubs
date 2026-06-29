import os, csv, io, json, uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
import bcrypt
import google.generativeai as genai
from dotenv import load_dotenv
from contextlib import asynccontextmanager

load_dotenv()

SECRET_KEY   = os.environ.get("SECRET_KEY")
ALGORITHM    = "HS256"
TOKEN_EXPIRE = 60 * 24 * 30
GEMINI_KEY   = os.environ.get("GEMINI_API_KEY", "")

# Single connection through Pgpool — it handles read/write routing
# and primary detection automatically, no application-level logic needed
PGPOOL_HOST = os.environ.get("POSTGRES_HOST", "pgpool-service")

DATABASE_URL = (
    f"postgresql://{os.environ['POSTGRES_USER']}"
    f":{os.environ['POSTGRES_PASSWORD']}"
    f"@{PGPOOL_HOST}"
    f":{os.environ['POSTGRES_PORT']}"
    f"/{os.environ['POSTGRES_DB']}"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id         = Column(Integer, primary_key=True, index=True)
    email      = Column(String, unique=True, nullable=False, index=True)
    password   = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Scan(Base):
    __tablename__ = "scans"
    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id    = Column(Integer, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Subscription(Base):
    __tablename__ = "subscriptions"
    id         = Column(Integer, primary_key=True, index=True)
    scan_id    = Column(String, nullable=False, index=True)
    name       = Column(String, nullable=False)
    amount     = Column(Float, nullable=False)
    currency   = Column(String, default="USD")
    interval   = Column(String, nullable=False)
    last_seen  = Column(String, nullable=True)
    category   = Column(String, nullable=True)
    is_ghost   = Column(Boolean, default=False)
    reason     = Column(Text, nullable=True)
    tagged_at  = Column(DateTime, nullable=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    # Encode the string password to bytes
    pwd_bytes = password.encode('utf-8')
    # Generate a salt and hash the password
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(pwd_bytes, salt)
    # Return as a string to save in the database
    return hashed_bytes.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Encode inputs to bytes and compare
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

def create_token(user_id: int, email: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE)
    return jwt.encode({"sub": str(user_id), "email": email, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(401, "Invalid or expired token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(401, "User not found")
    return user

def get_optional_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        return db.get(User, int(payload["sub"]))
    except Exception:
        return None

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)

def analyze_with_gemini(csv_text: str) -> list[dict]:
    if not GEMINI_KEY:
        print("WARNING: GEMINI_API_KEY not set — using fallback parser")
        return _fallback_parse(csv_text)

    print("Sending to Gemini 3.1 Flash Lite Flash...")
    model  = genai.GenerativeModel("gemini-3.1-flash-lite")
    prompt = f"""
You are a financial analyst. Analyze these bank transactions and identify recurring subscriptions.

Return a JSON array where each object has:
- "name": clean merchant/service name
- "amount": positive float
- "currency": default "USD"
- "interval": "weekly" | "monthly" | "yearly" | "unknown"
- "last_seen": most recent date YYYY-MM-DD
- "category": "streaming" | "software" | "news" | "fitness" | "food" | "finance" | "gaming" | "cloud" | "other"
- "is_ghost": true if subscription appears unused or wasteful
- "reason": one sentence why it seems ghosted (null if not ghosted)

Rules:
- Merge duplicate merchants (NETFLIX / Netflix.com = same)
- Skip one-off purchases, ATM withdrawals, bank transfers
- Flag as ghost: duplicate streaming services, tools unused for 60+ days, legacy plans
- Return ONLY a valid JSON array, no markdown fences, no explanation

Transactions:
{csv_text[:6000]}
"""
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text.strip())
        print(f"Gemini returned {len(result)} subscriptions")
        return result
    except Exception as e:
        print(f"Gemini error: {e} — using fallback")
        return _fallback_parse(csv_text)

def _fallback_parse(csv_text: str) -> list[dict]:
    from collections import defaultdict
    reader = csv.DictReader(io.StringIO(csv_text))
    counts: dict = defaultdict(list)
    for row in reader:
        desc    = (row.get("Description") or row.get("Merchant") or row.get("Name") or "").strip()
        amt_raw = (row.get("Amount") or row.get("Debit") or "0").replace("$","").replace(",","").strip()
        date    = row.get("Date") or row.get("Transaction Date") or ""
        try:
            amt = abs(float(amt_raw))
        except Exception:
            continue
        if amt > 0 and desc:
            counts[desc].append({"amount": amt, "date": date})
    return [
        {"name": name, "amount": txns[-1]["amount"], "currency": "USD",
         "interval": "monthly", "last_seen": txns[-1]["date"] or datetime.now().strftime("%Y-%m-%d"),
         "category": "other", "is_ghost": False, "reason": None}
        for name, txns in counts.items() if len(txns) >= 2
    ]

def _to_monthly(amount: float, interval: str) -> float:
    if interval == "weekly":  return amount * 4
    if interval == "yearly":  return amount / 12
    return amount

app = FastAPI(title="Ghost Subscriptions API", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class AuthRequest(BaseModel):
    email:    str
    password: str

class TagRequest(BaseModel):
    is_ghost: bool
    reason:   Optional[str] = None

@app.get("/api/health")
def health():
    return {"status": "ok", "gemini_enabled": bool(GEMINI_KEY)}

@app.post("/api/auth/register", status_code=201)
def register(body: AuthRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(409, "Email already registered")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    user = User(email=body.email.lower().strip(), password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_token(user.id, user.email), "user": {"id": user.id, "email": user.email}}

@app.post("/api/auth/login")
def login(body: AuthRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(401, "Invalid email or password")
    return {"token": create_token(user.id, user.email), "user": {"id": user.id, "email": user.email}}

@app.get("/api/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "created_at": current_user.created_at.isoformat() if current_user.created_at else None}

@app.post("/api/upload")
async def upload_csv(
    file: UploadFile = File(...),
    db:   Session    = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files accepted")

    contents  = await file.read()
    csv_text  = contents.decode("utf-8", errors="ignore")
    subs_data = analyze_with_gemini(csv_text)

    if not subs_data:
        raise HTTPException(422, "No recurring subscriptions detected")

    scan_id = str(uuid.uuid4())
    db.add(Scan(id=scan_id, user_id=current_user.id if current_user else None))

    for s in subs_data:
        db.add(Subscription(
            scan_id=scan_id,
            name=s.get("name", "Unknown"),
            amount=float(s.get("amount", 0)),
            currency=s.get("currency", "USD"),
            interval=s.get("interval", "monthly"),
            last_seen=s.get("last_seen", ""),
            category=s.get("category", "other"),
            is_ghost=bool(s.get("is_ghost", False)),
            reason=s.get("reason"),
        ))

    db.commit()
    return {"scan_id": scan_id, "count": len(subs_data)}

@app.get("/api/scans")
def list_scans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scans = (db.query(Scan)
               .filter(Scan.user_id == current_user.id)
               .order_by(Scan.created_at.desc())
               .all())
    result = []
    for sc in scans:
        subs = db.query(Subscription).filter(Subscription.scan_id == sc.id).all()
        total  = sum(_to_monthly(s.amount, s.interval) for s in subs)
        wasted = sum(_to_monthly(s.amount, s.interval) for s in subs if s.is_ghost)
        result.append({
            "scan_id":       sc.id,
            "created_at":    sc.created_at.isoformat() if sc.created_at else None,
            "total_subs":    len(subs),
            "ghost_count":   sum(1 for s in subs if s.is_ghost),
            "monthly_spend": round(total, 2),
            "ghost_monthly": round(wasted, 2),
        })
    return result

@app.get("/api/report/{scan_id}")
def get_report(scan_id: str, db: Session = Depends(get_db)):
    subs = db.query(Subscription).filter(Subscription.scan_id == scan_id).all()
    if not subs:
        raise HTTPException(404, "Scan not found")
    total  = sum(_to_monthly(s.amount, s.interval) for s in subs)
    wasted = sum(_to_monthly(s.amount, s.interval) for s in subs if s.is_ghost)
    return {
        "scan_id":             scan_id,
        "total_subscriptions": len(subs),
        "ghost_count":         sum(1 for s in subs if s.is_ghost),
        "total_monthly_spend": round(total, 2),
        "ghost_monthly":       round(wasted, 2),
        "ghost_yearly":        round(wasted * 12, 2),
        "subscriptions":       [
            {"id": s.id, "scan_id": s.scan_id, "name": s.name, "amount": s.amount,
             "currency": s.currency, "interval": s.interval, "last_seen": s.last_seen,
             "category": s.category, "is_ghost": s.is_ghost, "reason": s.reason,
             "tagged_at": s.tagged_at.isoformat() if s.tagged_at else None}
            for s in subs
        ],
    }

@app.patch("/api/subscriptions/{sub_id}/tag")
def tag_subscription(sub_id: int, body: TagRequest, db: Session = Depends(get_db)):
    sub = db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(404, "Subscription not found")
    sub.is_ghost  = body.is_ghost
    sub.reason    = body.reason
    sub.tagged_at = datetime.utcnow()
    db.commit()
    db.refresh(sub)
    return sub
