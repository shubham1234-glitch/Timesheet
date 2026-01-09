# app.py
"""
STS Timesheet System API - Simple Version
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


# Import timesheet routes
from routes.timesheet import router as timesheet_router
from routes.create_task import router as create_task_router
from routes.update_task_status import router as update_task_status_router
from routes.create_epic import router as create_epic_router
from routes.update_epic_status import router as update_epic_status_router
from routes.add_attachments import router as add_attachments_router
from routes.get_master_data import router as get_master_data_router
from routes.login import router as login_router
from routes.add_comment import router as add_comment_router
from routes.leave_application import router as leave_application_router
from routes.use_existing_epic import router as use_existing_epic_router
from routes.use_existing_task import router as use_existing_task_router
from routes.delete_task import router as delete_task_router
from routes.create_activity import router as create_activity_router
from routes.assign_task_to_self import router as assign_task_to_self_router
from routes.save_template import router as save_template_router



# Create FastAPI app
app = FastAPI(title="STS Timesheet API", version="1.0.0")

# =============================================================================
# STATIC FILES SERVING
# =============================================================================
# Comment out static files for local testing
app.mount("/files", StaticFiles(directory="/var/www/fileServer"), name="files")


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/", tags=["health"])
async def root():
    return {
        "message": "API is ready to serve requests",
        "status": "active"
    }

# Register timesheet routes
app.include_router(timesheet_router, tags=["timesheet"])

# Register task routes
app.include_router(create_task_router, tags=["tasks"])
app.include_router(update_task_status_router, tags=["tasks"])
app.include_router(use_existing_task_router, tags=["tasks"])
app.include_router(delete_task_router, tags=["tasks"])
app.include_router(assign_task_to_self_router, tags=["tasks"])
# Register epic routes
app.include_router(create_epic_router, tags=["epics"])
app.include_router(update_epic_status_router, tags=["epics"])
app.include_router(use_existing_epic_router, tags=["epics"])


# Register attachment routes
app.include_router(add_attachments_router, tags=["attachments"])

# Register master data routes
app.include_router(get_master_data_router, tags=["master-data"])

# Register comment routes
app.include_router(add_comment_router, tags=["comments"])

# Register login routes
app.include_router(login_router, tags=["login"])

# Register leave routes
app.include_router(leave_application_router, tags=["leave"])

# Register activity routes
app.include_router(create_activity_router, tags=["activities"])

# Register template routes (unified for epic and task templates)
app.include_router(save_template_router, tags=["templates"])