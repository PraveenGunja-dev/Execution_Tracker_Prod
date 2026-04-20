import socket
import os
import sys
from urllib.parse import urlparse
# Load settings to get endpoint
ENDPOINT = None
# 1. Try to get from explicit hardcoded fallback (User provided this earlier)
FALLBACK_ENDPOINT = "https://az10oaidmrctbtp01.openai.azure.com"
try:
    from dotenv import load_dotenv
    # Try loading from current dir and parent dir
    load_dotenv() 
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    
    ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT") or os.getenv("LLM_ENDPOINT")
except ImportError:
    print("Notice: python-dotenv not installed. Using fallback if available.")
if not ENDPOINT:
    print(f"Notice: Could not find endpoint in env. Using fallback: {FALLBACK_ENDPOINT}")
    ENDPOINT = FALLBACK_ENDPOINT
if not ENDPOINT:
    print("Error: No endpoint found. Please set AZURE_OPENAI_ENDPOINT in .env")
    sys.exit(1)
print(f"Diagnosing connection to: {ENDPOINT}")
try:
    parsed = urlparse(ENDPOINT)
    hostname = parsed.hostname
    port = parsed.port or 443
    print(f"Hostname: {hostname}")
    
    # 1. DNS Resolution
    print("\n--- DNS Resolution ---")
    try:
        ip_address = socket.gethostbyname(hostname)
        print(f"Resolved IP: {ip_address}")
        
        # Check if it looks like a private IP (simple check)
        if ip_address.startswith("10.") or ip_address.startswith("172.16.") or ip_address.startswith("192.168."):
             print("Result: Resolves to PRIVATE IP. This is good for Private Endpoint usage.")
        else:
             print("Result: Resolves to PUBLIC IP.")
             print("If you are using Private Endpoints, this suggests a DNS configuration issue.")
             print("If you are trying to access via Public Internet, ensure your IP is whitelisted in Azure.")
    except socket.gaierror as e:
        print(f"DNS Resolution Failed: {e}")
        sys.exit(1)
    # 2. Connectivity Check
    print(f"\n--- TCP Connectivity Test ({hostname}:{port}) ---")
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((hostname, port))
        if result == 0:
            print("Success: TCP connection established.")
        else:
            print(f"Failure: Could not connect (Error code: {result})")
            print("This suggests a firewall or network path issue.")
        sock.close()
    except Exception as e:
        print(f"Connectivity Error: {e}")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
