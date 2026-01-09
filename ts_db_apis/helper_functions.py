
# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


import sys
import os
sys.path.append('/opt/stage/src/')

from datetime import datetime
import pytz
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from config import load_config
from utils.logger import get_logger

config = load_config()
log_dir = config.get('log_dir')
log_file_name = config.get('log_file_name')

# Initialize logger
logger = get_logger(log_file_name, log_dir=log_dir)

# Initialize Argon2 password hasher
ph = PasswordHasher()

def get_current_time_ist():
    """
    Get current time in India Standard Time (IST) as naive datetime
    """
    ist = pytz.timezone('Asia/Kolkata')
    ist_time = datetime.now(ist)
    # Return naive datetime (without timezone info) so PostgreSQL doesn't convert it
    return ist_time.replace(tzinfo=None)




def verify_hash_pw(hashed_password: str, plain_password: str) -> bool:
    """
    Verify a plain text password against its Argon2 hash
    
    Args:
        hashed_password (str): The stored password hash
        plain_password (str): The plain text password to verify
        
    Returns:
        bool: True if password matches, False otherwise
    """
    try:
        ph.verify(hashed_password, plain_password)
        logger.info(f"[INFO] Password verification successful")
        return True
    except VerifyMismatchError:
        logger.warning(f"[WARNING] Password verification failed - mismatch")
        return False
    except Exception as e:
        logger.error(f"[ERROR] Password verification error: {str(e)}")
        return False





def hash_password(plain_password: str) -> str:
    """
    Hash a plain text password using Argon2
    
    Args:
        plain_password (str): The plain text password to hash
        
    Returns:
        str: The hashed password
    """
    try:
        hashed_password = ph.hash(plain_password)
        logger.info(f"[INFO] Password hashed successfully")
        return hashed_password
    except Exception as e:
        logger.error(f"[ERROR] Password hashing error: {str(e)}")
        raise 


def parse_date(date_string):
    """Parse date string supporting both DD-MM-YYYY and YYYY-MM-DD formats"""
    if not date_string:
        return None
    
    # Try DD-MM-YYYY format first
    try:
        return datetime.strptime(date_string, "%d-%m-%Y").date()
    except ValueError:
        pass
    
    # Try YYYY-MM-DD format
    try:
        return datetime.strptime(date_string, "%Y-%m-%d").date()
    except ValueError:
        pass
    
    # If both fail, raise error
    raise ValueError(f"Invalid date format: {date_string}. Expected DD-MM-YYYY or YYYY-MM-DD")



def format_file_size(bytes_size):
    if bytes_size == 0:
        return "0 B"
    elif bytes_size < 1024:
        return f"{bytes_size} B"
    elif bytes_size < 1024 * 1024:
        return f"{bytes_size / 1024:.1f} KB"
    elif bytes_size < 1024 * 1024 * 1024:
        return f"{bytes_size / (1024 * 1024):.1f} MB"
    else:
        return f"{bytes_size / (1024 * 1024 * 1024):.1f} GB"