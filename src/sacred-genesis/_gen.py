#!/usr/bin/env python3
import os, math
OUT = "/home/user/workspace/heady-max"
PHI = (1 + math.sqrt(5)) / 2
PSI = 1 / PHI

def w(path, content):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f: f.write(content)
    return len(content.split())

print("Script loaded, generating...")
