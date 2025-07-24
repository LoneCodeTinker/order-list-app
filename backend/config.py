import os
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

# Helper to get env with default and type
getenv = lambda key, default=None, cast=str: cast(os.getenv(key, default))

# --- Core paths and server config ---
ORDER_SAVE_DIR = getenv('ORDER_SAVE_DIR', './orders')
UPLOADED_INVENTORY_DIR = getenv('UPLOADED_INVENTORY_DIR', './uploaded_inventory')
LOG_FILE_PATH = getenv('LOG_FILE_PATH', './errors_log/shutting_down_errors.txt')
LOG_LEVEL = getenv('LOG_LEVEL', 'INFO')

# --- Server/host/port config ---
BACKEND_PORT = int(getenv('BACKEND_PORT', 8000))
FRONTEND_PORT = int(getenv('FRONTEND_PORT', 5173))
LOCAL_IP = getenv('LOCAL_IP', '127.0.0.1')
HOSTNAME = getenv('HOSTNAME', os.uname().nodename if hasattr(os, 'uname') else 'localhost')
SERVER_NAMES = getenv('SERVER_NAMES', f'localhost,{LOCAL_IP},{HOSTNAME}')
ALLOWED_ORIGINS = getenv('ALLOWED_ORIGINS', f'http://localhost:{FRONTEND_PORT},http://127.0.0.1:{FRONTEND_PORT}')

# --- Remote upload (future) ---
REMOTE_USERNAME = getenv('REMOTE_USERNAME', '')
REMOTE_PASSWORD = getenv('REMOTE_PASSWORD', '')
REMOTE_DEST = getenv('REMOTE_DEST', '')

# --- Utility: get all hostnames for mkcert/SSL ---
def get_ssl_hostnames():
    return [h.strip() for h in SERVER_NAMES.split(',') if h.strip()]

