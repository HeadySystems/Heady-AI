import os
import re

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        new_content = content
        if 'priority:' in new_content.lower() or 'priority =' in new_content.lower():
            # Replace common Python priority assignments with relevance
            new_content = re.sub(r'priority\s*=\s*["\'](CRITICAL|HIGH|MEDIUM|LOW)["\']', 'relevance_gate = 0.618', new_content, flags=re.IGNORECASE)

        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated priority in: {filepath}")
    except Exception:
        pass

for root, _, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or 'AndroidSDK' in root:
        continue
    for file in files:
        if file.endswith('.py') or file.endswith('.yaml') or file.endswith('.json'):
            fix_file(os.path.join(root, file))
