import sys
import os

print("--- Environment Check Report ---")
print(f"Python: {sys.version}")

try:
    import httpx
    print("httpx: Installed")
except ImportError:
    print("httpx: Not Installed")

try:
    import fastapi
    print("fastapi: Installed")
except ImportError:
    print("fastapi: Not Installed")

import urllib.request
try:
    resp = urllib.request.urlopen("http://localhost:11434")
    print(f"Ollama: Reachable (Status {resp.getcode()})")
except Exception as e:
    print(f"Ollama: Not Reachable ({e})")

print("--- End Report ---")
