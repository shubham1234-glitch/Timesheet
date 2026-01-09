# config.py

# Standard library imports
import configparser
import os
from typing import Dict, Any

def load_config() -> Dict[str, Any]:
    """Load configuration settings from a common 'config.ini' file.
    
    Returns:
        dict: A dictionary containing configuration settings:
            - Database settings
            
    Raises:
        FileNotFoundError: If config.config is not found
        KeyError: If required configuration keys are missing
        ValueError: If type conversion fails
        configparser.ParsingError: If config file parsing fails
        OSError: If there are OS-related errors
        RuntimeError: For any other unexpected errors
    """
    try:

        config = configparser.ConfigParser(interpolation=None, strict=False)
        # Load the config file
        config_file_path = os.path.join(os.path.dirname(__file__), 'config.ini')
        if not os.path.exists(config_file_path):
            raise FileNotFoundError(f"Configuration file not found at: {config_file_path}")

        config.read(config_file_path)


        combined_config = {
            # Database settings
            'host': config['postgresql']['host'],
            'port': int(config['postgresql']['port']),
            'username': config['postgresql']['username'],
            'password': config['postgresql']['password'],
            'database_name': config['postgresql']['database_name'],
            
            # Schema settings
            'primary_schema': config['schemas']['primary_schema'],
            'user_schema': config['schemas']['user_schema'],
            
            # Security settings
            'login_secret_key': config['security']['login_secret_key'],
            'algorithm': config['security']['algorithm'],
            'access_token_expire_minutes': int(config['security']['access_token_expire_minutes']),
            'refresh_token_expire_days': int(config['security']['refresh_token_expire_days']),
            
            # Fileserver settings
            'base_url': config['fileserver']['base_url'],
            'upload_dir': config['fileserver']['upload_dir'],
            
            # Logging settings
            'log_dir': config['logs']['log_dir'],
            'log_file_name': config['logs']['log_file_name'],
            
            # Permissions settings
            'admin_designations': [d.strip().lower() for d in config['permissions']['admin_designations'].split(',')],
        }


        return combined_config

    except KeyError as key_error:
        raise KeyError(f"Missing configuration key: {str(key_error)}") from key_error

    except configparser.ParsingError as parse_error:
        raise configparser.ParsingError(f"Error parsing configuration file: {str(parse_error)}") from parse_error

    except FileNotFoundError as fnf_error:
        raise FileNotFoundError(f"Config file not found: {str(fnf_error)}") from fnf_error

    except ValueError as val_error:
        raise ValueError(f"Invalid type conversion in configuration: {str(val_error)}") from val_error

    except OSError as os_error:
        raise OSError(f"OS error while accessing config file: {str(os_error)}") from os_error

    except Exception as other_error:
        raise RuntimeError(f"Unexpected error while loading config: {str(other_error)}") from other_error 


