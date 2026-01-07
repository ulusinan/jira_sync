from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import base64
import asyncio
from contextlib import asynccontextmanager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'jirasync-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

# Scheduler
scheduler = AsyncIOScheduler()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class JiraSettingsCreate(BaseModel):
    cloud_url: str
    cloud_email: str
    cloud_api_token: str
    onprem_url: str
    onprem_username: str
    onprem_password: str
    sync_interval_minutes: int = 15

class JiraSettingsResponse(BaseModel):
    id: str
    cloud_url: str
    cloud_email: str
    onprem_url: str
    onprem_username: str
    sync_interval_minutes: int
    is_connected: bool = False
    last_sync: Optional[str] = None

class ProjectMappingCreate(BaseModel):
    cloud_project_key: str
    cloud_project_name: str
    onprem_project_key: str
    onprem_project_name: str
    is_active: bool = True

class ProjectMappingResponse(BaseModel):
    id: str
    cloud_project_key: str
    cloud_project_name: str
    onprem_project_key: str
    onprem_project_name: str
    is_active: bool
    created_at: str

class IssueTypeMappingCreate(BaseModel):
    cloud_issue_type: str
    onprem_issue_type: str

class IssueTypeMappingResponse(BaseModel):
    id: str
    cloud_issue_type: str
    onprem_issue_type: str
    created_at: str

class TransferLogResponse(BaseModel):
    id: str
    cloud_issue_key: str
    cloud_issue_summary: str
    onprem_issue_key: Optional[str]
    status: str  # pending, success, failed
    error_message: Optional[str]
    created_at: str
    completed_at: Optional[str]

class SyncStatusResponse(BaseModel):
    is_running: bool
    last_sync: Optional[str]
    next_sync: Optional[str]
    total_synced: int
    total_errors: int

class CloudProjectResponse(BaseModel):
    key: str
    name: str

class OnPremProjectResponse(BaseModel):
    key: str
    name: str

class CloudIssueTypeResponse(BaseModel):
    name: str

class OnPremIssueTypeResponse(BaseModel):
    name: str

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== JIRA API HELPERS ====================

async def get_jira_settings(user_id: str):
    settings = await db.jira_settings.find_one({"user_id": user_id}, {"_id": 0})
    return settings

async def fetch_cloud_projects(settings: dict) -> List[dict]:
    """Fetch projects from Jira Cloud"""
    try:
        auth_str = f"{settings['cloud_email']}:{settings['cloud_api_token']}"
        auth_bytes = base64.b64encode(auth_str.encode()).decode()
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{settings['cloud_url']}/rest/api/3/project",
                headers={
                    "Authorization": f"Basic {auth_bytes}",
                    "Accept": "application/json"
                }
            )
            if response.status_code == 401:
                raise Exception("401 Unauthorized - E-posta veya API Token hatalı")
            if response.status_code == 403:
                raise Exception("403 Forbidden - API Token'ın proje listeleme yetkisi yok")
            if response.status_code == 404:
                raise Exception("404 Not Found - URL adresi hatalı veya API endpoint bulunamadı")
            response.raise_for_status()
            projects = response.json()
            return [{"key": p["key"], "name": p["name"]} for p in projects]
    except httpx.ConnectError as e:
        raise Exception(f"Bağlantı hatası - Sunucuya erişilemiyor: {str(e)}")
    except httpx.TimeoutException:
        raise Exception("Zaman aşımı - Sunucu yanıt vermedi (30 saniye)")
    except httpx.HTTPStatusError as e:
        raise Exception(f"HTTP Hatası {e.response.status_code}: {e.response.text[:200]}")
    except Exception as e:
        logger.error(f"Error fetching cloud projects: {e}")
        raise

async def fetch_onprem_projects(settings: dict) -> List[dict]:
    """Fetch projects from Jira On-Premise"""
    try:
        auth_str = f"{settings['onprem_username']}:{settings['onprem_password']}"
        auth_bytes = base64.b64encode(auth_str.encode()).decode()
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(
                f"{settings['onprem_url']}/rest/api/2/project",
                headers={
                    "Authorization": f"Basic {auth_bytes}",
                    "Accept": "application/json"
                }
            )
            if response.status_code == 401:
                raise Exception("401 Unauthorized - Kullanıcı adı veya şifre hatalı")
            if response.status_code == 403:
                raise Exception("403 Forbidden - Kullanıcının API erişim yetkisi yok")
            if response.status_code == 404:
                raise Exception("404 Not Found - URL adresi hatalı veya Jira REST API aktif değil")
            response.raise_for_status()
            projects = response.json()
            return [{"key": p["key"], "name": p["name"]} for p in projects]
    except httpx.ConnectError as e:
        error_msg = str(e)
        if "Connection refused" in error_msg:
            raise Exception("Bağlantı reddedildi - Sunucu portu kapalı veya firewall engelliyor")
        elif "getaddrinfo" in error_msg or "Name or service not known" in error_msg:
            raise Exception("DNS çözümlenemedi - URL adresi hatalı veya sunucu bulunamıyor")
        raise Exception(f"Bağlantı hatası: {error_msg}")
    except httpx.TimeoutException:
        raise Exception("Zaman aşımı - Sunucu 30 saniye içinde yanıt vermedi")
    except httpx.HTTPStatusError as e:
        raise Exception(f"HTTP Hatası {e.response.status_code}: {e.response.text[:200]}")
    except Exception as e:
        logger.error(f"Error fetching on-prem projects: {e}")
        raise

async def fetch_cloud_issue_types(settings: dict) -> List[dict]:
    """Fetch issue types from Jira Cloud"""
    try:
        auth_str = f"{settings['cloud_email']}:{settings['cloud_api_token']}"
        auth_bytes = base64.b64encode(auth_str.encode()).decode()
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{settings['cloud_url']}/rest/api/3/issuetype",
                headers={
                    "Authorization": f"Basic {auth_bytes}",
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            types = response.json()
            seen = set()
            unique_types = []
            for t in types:
                if t["name"] not in seen:
                    seen.add(t["name"])
                    unique_types.append({"name": t["name"]})
            return unique_types
    except Exception as e:
        logger.error(f"Error fetching cloud issue types: {e}")
        raise HTTPException(status_code=500, detail=f"Cloud connection error: {str(e)}")

async def fetch_onprem_issue_types(settings: dict) -> List[dict]:
    """Fetch issue types from Jira On-Premise"""
    try:
        auth_str = f"{settings['onprem_username']}:{settings['onprem_password']}"
        auth_bytes = base64.b64encode(auth_str.encode()).decode()
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(
                f"{settings['onprem_url']}/rest/api/2/issuetype",
                headers={
                    "Authorization": f"Basic {auth_bytes}",
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            types = response.json()
            seen = set()
            unique_types = []
            for t in types:
                if t["name"] not in seen:
                    seen.add(t["name"])
                    unique_types.append({"name": t["name"]})
            return unique_types
    except Exception as e:
        logger.error(f"Error fetching on-prem issue types: {e}")
        raise HTTPException(status_code=500, detail=f"On-Premise connection error: {str(e)}")

# ==================== SYNC ENGINE ====================

async def sync_issues_for_user(user_id: str):
    """Main sync function that transfers issues from Cloud to On-Premise"""
    settings = await get_jira_settings(user_id)
    if not settings:
        logger.warning(f"No Jira settings found for user {user_id}")
        return
    
    # Get active project mappings
    mappings = await db.project_mappings.find(
        {"user_id": user_id, "is_active": True}, 
        {"_id": 0}
    ).to_list(100)
    
    if not mappings:
        logger.info(f"No active project mappings for user {user_id}")
        return
    
    # Get issue type mappings
    issue_type_mappings = {}
    type_mappings = await db.issue_type_mappings.find(
        {"user_id": user_id}, 
        {"_id": 0}
    ).to_list(100)
    for tm in type_mappings:
        issue_type_mappings[tm['cloud_issue_type']] = tm['onprem_issue_type']
    
    cloud_auth = base64.b64encode(
        f"{settings['cloud_email']}:{settings['cloud_api_token']}".encode()
    ).decode()
    
    onprem_auth = base64.b64encode(
        f"{settings['onprem_username']}:{settings['onprem_password']}".encode()
    ).decode()
    
    for mapping in mappings:
        try:
            # Fetch recent issues from Cloud project
            async with httpx.AsyncClient(timeout=60.0) as http_client:
                # Get issues created in last sync interval
                jql = f"project = {mapping['cloud_project_key']} ORDER BY created DESC"
                response = await http_client.get(
                    f"{settings['cloud_url']}/rest/api/3/search",
                    params={"jql": jql, "maxResults": 50, "fields": "summary,description,priority,assignee,issuetype"},
                    headers={
                        "Authorization": f"Basic {cloud_auth}",
                        "Accept": "application/json"
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                for issue in data.get('issues', []):
                    # Check if already synced
                    existing = await db.transfer_logs.find_one({
                        "user_id": user_id,
                        "cloud_issue_key": issue['key']
                    })
                    
                    if existing:
                        continue
                    
                    # Create transfer log
                    log_id = str(uuid.uuid4())
                    log_entry = {
                        "id": log_id,
                        "user_id": user_id,
                        "cloud_issue_key": issue['key'],
                        "cloud_issue_summary": issue['fields'].get('summary', 'No summary'),
                        "onprem_issue_key": None,
                        "status": "pending",
                        "error_message": None,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "completed_at": None
                    }
                    await db.transfer_logs.insert_one(log_entry)
                    
                    try:
                        # Map issue type
                        cloud_type = issue['fields'].get('issuetype', {}).get('name', 'Task')
                        onprem_type = issue_type_mappings.get(cloud_type, cloud_type)
                        
                        # Prepare issue for On-Premise
                        description = issue['fields'].get('description', '')
                        if isinstance(description, dict):
                            # Handle Atlassian Document Format
                            description = str(description)
                        
                        new_issue = {
                            "fields": {
                                "project": {"key": mapping['onprem_project_key']},
                                "summary": issue['fields'].get('summary', 'Synced from Cloud'),
                                "description": description or "Synced from Jira Cloud",
                                "issuetype": {"name": onprem_type}
                            }
                        }
                        
                        # Add priority if available
                        if issue['fields'].get('priority'):
                            new_issue['fields']['priority'] = {"name": issue['fields']['priority']['name']}
                        
                        # Create issue in On-Premise
                        async with httpx.AsyncClient(timeout=30.0, verify=False) as onprem_client:
                            create_response = await onprem_client.post(
                                f"{settings['onprem_url']}/rest/api/2/issue",
                                json=new_issue,
                                headers={
                                    "Authorization": f"Basic {onprem_auth}",
                                    "Content-Type": "application/json"
                                }
                            )
                            create_response.raise_for_status()
                            created = create_response.json()
                            
                            # Update log with success
                            await db.transfer_logs.update_one(
                                {"id": log_id},
                                {"$set": {
                                    "onprem_issue_key": created.get('key'),
                                    "status": "success",
                                    "completed_at": datetime.now(timezone.utc).isoformat()
                                }}
                            )
                            logger.info(f"Synced {issue['key']} -> {created.get('key')}")
                    
                    except Exception as e:
                        # Update log with error
                        await db.transfer_logs.update_one(
                            {"id": log_id},
                            {"$set": {
                                "status": "failed",
                                "error_message": str(e),
                                "completed_at": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                        logger.error(f"Failed to sync {issue['key']}: {e}")
        
        except Exception as e:
            logger.error(f"Error syncing project {mapping['cloud_project_key']}: {e}")
    
    # Update last sync time
    await db.jira_settings.update_one(
        {"user_id": user_id},
        {"$set": {"last_sync": datetime.now(timezone.utc).isoformat()}}
    )

async def run_scheduled_sync():
    """Run sync for all users with active settings"""
    logger.info("Starting scheduled sync...")
    users = await db.jira_settings.find({}, {"_id": 0, "user_id": 1}).to_list(1000)
    for user in users:
        try:
            await sync_issues_for_user(user['user_id'])
        except Exception as e:
            logger.error(f"Scheduled sync error for user {user['user_id']}: {e}")
    logger.info("Scheduled sync completed")

# ==================== LIFESPAN ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    scheduler.add_job(
        run_scheduled_sync,
        IntervalTrigger(minutes=15),
        id='sync_job',
        replace_existing=True
    )
    scheduler.start()
    logger.info("Scheduler started - sync every 15 minutes")
    yield
    # Shutdown
    scheduler.shutdown()
    client.close()

# Create the main app
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    token = create_token(user_id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=data.email,
            name=data.name,
            created_at=user['created_at']
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user['id'])
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user['id'],
            email=user['email'],
            name=user['name'],
            created_at=user['created_at']
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    return UserResponse(
        id=user['id'],
        email=user['email'],
        name=user['name'],
        created_at=user['created_at']
    )

# ==================== JIRA SETTINGS ROUTES ====================

@api_router.post("/settings/jira", response_model=JiraSettingsResponse)
async def create_or_update_jira_settings(data: JiraSettingsCreate, user=Depends(get_current_user)):
    settings_id = str(uuid.uuid4())
    settings = {
        "id": settings_id,
        "user_id": user['id'],
        "cloud_url": data.cloud_url.rstrip('/'),
        "cloud_email": data.cloud_email,
        "cloud_api_token": data.cloud_api_token,
        "onprem_url": data.onprem_url.rstrip('/'),
        "onprem_username": data.onprem_username,
        "onprem_password": data.onprem_password,
        "sync_interval_minutes": data.sync_interval_minutes,
        "is_connected": False,
        "last_sync": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert
    await db.jira_settings.update_one(
        {"user_id": user['id']},
        {"$set": settings},
        upsert=True
    )
    
    return JiraSettingsResponse(
        id=settings_id,
        cloud_url=settings['cloud_url'],
        cloud_email=settings['cloud_email'],
        onprem_url=settings['onprem_url'],
        onprem_username=settings['onprem_username'],
        sync_interval_minutes=settings['sync_interval_minutes'],
        is_connected=False,
        last_sync=None
    )

@api_router.get("/settings/jira", response_model=Optional[JiraSettingsResponse])
async def get_jira_settings_route(user=Depends(get_current_user)):
    settings = await db.jira_settings.find_one({"user_id": user['id']}, {"_id": 0})
    if not settings:
        return None
    
    return JiraSettingsResponse(
        id=settings['id'],
        cloud_url=settings['cloud_url'],
        cloud_email=settings['cloud_email'],
        onprem_url=settings['onprem_url'],
        onprem_username=settings['onprem_username'],
        sync_interval_minutes=settings['sync_interval_minutes'],
        is_connected=settings.get('is_connected', False),
        last_sync=settings.get('last_sync')
    )

@api_router.post("/settings/jira/test")
async def test_jira_connection(user=Depends(get_current_user)):
    settings = await db.jira_settings.find_one({"user_id": user['id']}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Jira settings not found")
    
    results = {"cloud": False, "onprem": False, "cloud_error": None, "onprem_error": None}
    
    # Test Cloud
    try:
        await fetch_cloud_projects(settings)
        results['cloud'] = True
    except Exception as e:
        results['cloud_error'] = str(e)
    
    # Test On-Premise
    try:
        await fetch_onprem_projects(settings)
        results['onprem'] = True
    except Exception as e:
        results['onprem_error'] = str(e)
    
    # Update connection status
    is_connected = results['cloud'] and results['onprem']
    await db.jira_settings.update_one(
        {"user_id": user['id']},
        {"$set": {"is_connected": is_connected}}
    )
    
    return results

# ==================== PROJECT ROUTES ====================

@api_router.get("/projects/cloud", response_model=List[CloudProjectResponse])
async def get_cloud_projects(user=Depends(get_current_user)):
    settings = await db.jira_settings.find_one({"user_id": user['id']}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Jira settings not found")
    return await fetch_cloud_projects(settings)

@api_router.get("/projects/onprem", response_model=List[OnPremProjectResponse])
async def get_onprem_projects(user=Depends(get_current_user)):
    settings = await db.jira_settings.find_one({"user_id": user['id']}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Jira settings not found")
    return await fetch_onprem_projects(settings)

@api_router.get("/projects/mappings", response_model=List[ProjectMappingResponse])
async def get_project_mappings(user=Depends(get_current_user)):
    mappings = await db.project_mappings.find(
        {"user_id": user['id']}, 
        {"_id": 0}
    ).to_list(100)
    return mappings

@api_router.post("/projects/mappings", response_model=ProjectMappingResponse)
async def create_project_mapping(data: ProjectMappingCreate, user=Depends(get_current_user)):
    # Check if mapping already exists
    existing = await db.project_mappings.find_one({
        "user_id": user['id'],
        "cloud_project_key": data.cloud_project_key
    })
    if existing:
        raise HTTPException(status_code=400, detail="Mapping for this cloud project already exists")
    
    mapping_id = str(uuid.uuid4())
    mapping = {
        "id": mapping_id,
        "user_id": user['id'],
        "cloud_project_key": data.cloud_project_key,
        "cloud_project_name": data.cloud_project_name,
        "onprem_project_key": data.onprem_project_key,
        "onprem_project_name": data.onprem_project_name,
        "is_active": data.is_active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.project_mappings.insert_one(mapping)
    
    return ProjectMappingResponse(**mapping)

@api_router.delete("/projects/mappings/{mapping_id}")
async def delete_project_mapping(mapping_id: str, user=Depends(get_current_user)):
    result = await db.project_mappings.delete_one({
        "id": mapping_id,
        "user_id": user['id']
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"message": "Mapping deleted"}

@api_router.patch("/projects/mappings/{mapping_id}/toggle")
async def toggle_project_mapping(mapping_id: str, user=Depends(get_current_user)):
    mapping = await db.project_mappings.find_one({
        "id": mapping_id,
        "user_id": user['id']
    }, {"_id": 0})
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    new_status = not mapping.get('is_active', True)
    await db.project_mappings.update_one(
        {"id": mapping_id},
        {"$set": {"is_active": new_status}}
    )
    return {"is_active": new_status}

# ==================== ISSUE TYPE ROUTES ====================

@api_router.get("/issuetypes/cloud", response_model=List[CloudIssueTypeResponse])
async def get_cloud_issue_types(user=Depends(get_current_user)):
    settings = await db.jira_settings.find_one({"user_id": user['id']}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Jira settings not found")
    return await fetch_cloud_issue_types(settings)

@api_router.get("/issuetypes/onprem", response_model=List[OnPremIssueTypeResponse])
async def get_onprem_issue_types(user=Depends(get_current_user)):
    settings = await db.jira_settings.find_one({"user_id": user['id']}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Jira settings not found")
    return await fetch_onprem_issue_types(settings)

@api_router.get("/issuetypes/mappings", response_model=List[IssueTypeMappingResponse])
async def get_issue_type_mappings(user=Depends(get_current_user)):
    mappings = await db.issue_type_mappings.find(
        {"user_id": user['id']}, 
        {"_id": 0}
    ).to_list(100)
    return mappings

@api_router.post("/issuetypes/mappings", response_model=IssueTypeMappingResponse)
async def create_issue_type_mapping(data: IssueTypeMappingCreate, user=Depends(get_current_user)):
    # Check if mapping already exists
    existing = await db.issue_type_mappings.find_one({
        "user_id": user['id'],
        "cloud_issue_type": data.cloud_issue_type
    })
    if existing:
        raise HTTPException(status_code=400, detail="Mapping for this issue type already exists")
    
    mapping_id = str(uuid.uuid4())
    mapping = {
        "id": mapping_id,
        "user_id": user['id'],
        "cloud_issue_type": data.cloud_issue_type,
        "onprem_issue_type": data.onprem_issue_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.issue_type_mappings.insert_one(mapping)
    
    return IssueTypeMappingResponse(**mapping)

@api_router.delete("/issuetypes/mappings/{mapping_id}")
async def delete_issue_type_mapping(mapping_id: str, user=Depends(get_current_user)):
    result = await db.issue_type_mappings.delete_one({
        "id": mapping_id,
        "user_id": user['id']
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"message": "Mapping deleted"}

# ==================== SYNC ROUTES ====================

@api_router.post("/sync/trigger")
async def trigger_sync(background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    settings = await db.jira_settings.find_one({"user_id": user['id']}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Jira settings not found")
    
    background_tasks.add_task(sync_issues_for_user, user['id'])
    return {"message": "Sync started"}

@api_router.get("/sync/status", response_model=SyncStatusResponse)
async def get_sync_status(user=Depends(get_current_user)):
    settings = await db.jira_settings.find_one({"user_id": user['id']}, {"_id": 0})
    
    # Get stats
    total_synced = await db.transfer_logs.count_documents({
        "user_id": user['id'],
        "status": "success"
    })
    total_errors = await db.transfer_logs.count_documents({
        "user_id": user['id'],
        "status": "failed"
    })
    
    last_sync = settings.get('last_sync') if settings else None
    
    # Calculate next sync
    next_sync = None
    if last_sync:
        last_sync_dt = datetime.fromisoformat(last_sync.replace('Z', '+00:00'))
        next_sync_dt = last_sync_dt + timedelta(minutes=15)
        next_sync = next_sync_dt.isoformat()
    
    return SyncStatusResponse(
        is_running=False,
        last_sync=last_sync,
        next_sync=next_sync,
        total_synced=total_synced,
        total_errors=total_errors
    )

# ==================== TRANSFER LOG ROUTES ====================

@api_router.get("/logs", response_model=List[TransferLogResponse])
async def get_transfer_logs(
    limit: int = 50,
    status: Optional[str] = None,
    user=Depends(get_current_user)
):
    query = {"user_id": user['id']}
    if status:
        query['status'] = status
    
    logs = await db.transfer_logs.find(
        query, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return logs

@api_router.get("/logs/stats")
async def get_log_stats(user=Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user['id']}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    results = await db.transfer_logs.aggregate(pipeline).to_list(10)
    
    stats = {"pending": 0, "success": 0, "failed": 0}
    for r in results:
        stats[r['_id']] = r['count']
    
    return stats

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user=Depends(get_current_user)):
    # Get various stats
    total_mappings = await db.project_mappings.count_documents({"user_id": user['id']})
    active_mappings = await db.project_mappings.count_documents({"user_id": user['id'], "is_active": True})
    total_synced = await db.transfer_logs.count_documents({"user_id": user['id'], "status": "success"})
    total_errors = await db.transfer_logs.count_documents({"user_id": user['id'], "status": "failed"})
    total_pending = await db.transfer_logs.count_documents({"user_id": user['id'], "status": "pending"})
    
    settings = await db.jira_settings.find_one({"user_id": user['id']}, {"_id": 0})
    is_connected = settings.get('is_connected', False) if settings else False
    last_sync = settings.get('last_sync') if settings else None
    
    return {
        "total_mappings": total_mappings,
        "active_mappings": active_mappings,
        "total_synced": total_synced,
        "total_errors": total_errors,
        "total_pending": total_pending,
        "is_connected": is_connected,
        "last_sync": last_sync
    }

@api_router.get("/dashboard/recent-logs", response_model=List[TransferLogResponse])
async def get_recent_logs(user=Depends(get_current_user)):
    logs = await db.transfer_logs.find(
        {"user_id": user['id']}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    return logs

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
