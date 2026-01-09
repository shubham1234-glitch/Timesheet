# auth/jwt_handler.py

import sys
import os

from datetime import timedelta
from jose import jwt, JWTError
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import load_config
from utils.logger import get_logger
from helper_functions import get_current_time_ist

config = load_config()

SECRET_KEY = config["login_secret_key"]
ALGORITHM = config["algorithm"]
ACCESS_EXPIRE_MINUTES = int(config["access_token_expire_minutes"])
REFRESH_EXPIRE_DAYS = int(config["refresh_token_expire_days"])

# Initialize logger for this module
log_dir = config.get('log_dir')
log_file_name = config.get('log_file_name')
logger = get_logger(log_file_name, log_dir=log_dir)

security = HTTPBearer()

def create_access_token(data: dict):
    """
    Create a JWT access token with an expiration time.

    Args:
        data (dict): The payload data to encode in the JWT.

    Returns:
        str: The encoded JWT as a string.
    """
    logger.info(f"[INFO] Starting JWT token creation for user_code: {data.get('user_code', 'unknown')}")
    
    try:
        to_encode = data.copy()  # Make a copy of the data to avoid mutating the original

        # Set the expiration time for the access token (short-lived)
        expire = get_current_time_ist() + timedelta(minutes=ACCESS_EXPIRE_MINUTES)
        logger.info(f"[INFO] Access token expiration set to: {expire} (expires in {ACCESS_EXPIRE_MINUTES} minutes)")

        to_encode.update({
            "exp": expire,  # Add expiration claim to the payload
            "token_type": "login"  # Differentiate from upload tokens
        })

        # Encode the JWT using the secret key and algorithm
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        
        logger.info(f"[INFO] JWT token created successfully for user_code: {data.get('user_code', 'unknown')}")
        return encoded_jwt
        
    except Exception as e:
        logger.error(f"[ERROR] Failed to create JWT token for user_code: {data.get('user_code', 'unknown')}, error: {str(e)}")
        raise


def create_refresh_token(data: dict):
    """
    Create a JWT refresh token with a longer expiration time.

    Args:
        data (dict): The payload data to encode in the JWT.

    Returns:
        str: The encoded JWT refresh token as a string.
    """
    logger.info(f"[INFO] Starting JWT refresh token creation for user_code: {data.get('user_code', 'unknown')}")
    
    try:
        to_encode = data.copy()  # Make a copy of the data to avoid mutating the original

        # Set the expiration time for the refresh token (long-lived)
        expire = get_current_time_ist() + timedelta(days=REFRESH_EXPIRE_DAYS)
        logger.info(f"[INFO] Refresh token expiration set to: {expire} (expires in {REFRESH_EXPIRE_DAYS} days)")

        to_encode.update({
            "exp": expire,  # Add expiration claim to the payload
            "token_type": "refresh"  # Differentiate from access tokens
        })

        # Encode the JWT using the secret key and algorithm
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        
        logger.info(f"[INFO] JWT refresh token created successfully for user_code: {data.get('user_code', 'unknown')}")
        return encoded_jwt
        
    except Exception as e:
        logger.error(f"[ERROR] Failed to create JWT refresh token for user_code: {data.get('user_code', 'unknown')}, error: {str(e)}")
        raise



def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Verify and decode JWT token from Authorization header.
    
    Args:
        credentials: HTTPAuthorizationCredentials from the request header
        
    Returns:
        dict: Decoded token payload with user_code and role
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    logger.info(f"[INFO] Starting JWT token verification")
    
    try:
        # Decode the JWT token
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        logger.info(f"[INFO] JWT token decoded successfully")
        
        user_code: str = payload.get("user_code")
        user_role: str = payload.get("role", "employee")
        token_type: str = payload.get("token_type", "login")
        
        logger.info(f"[INFO] Token details - user_code: {user_code}, role: {user_role}, token_type: {token_type}")
        
        # Verify this is a login token, not an upload token
        if token_type != "login":
            logger.warning(f"[WARNING] Invalid token type received: {token_type}, expected: login")
            raise HTTPException(status_code=401, detail="Invalid token type - login token required")
        
        if not user_code:
            logger.warning(f"[WARNING] Token verification failed - user_code is None")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        logger.info(f"[INFO] JWT token verified successfully for user_code: {user_code}")
        
        return {
            "user_code": user_code,
            "role": user_role,
            "token_type": token_type,
            "payload": payload
        }

    except JWTError as e:
        logger.error(f"[ERROR] JWT token verification failed - JWTError: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"[ERROR] Unexpected error during JWT token verification: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")