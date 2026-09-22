import os
import re

def scan_files(dir_path):
    issues = []
    for root, _, files in os.walk(dir_path):
        for file in files:
            if file.endswith('.jsx') or file.endswith('.js'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        if re.search(r'catch\s*\([^\)]*\)\s*\{\s*\}', line):
                            issues.append({'file': path, 'line': i+1, 'type': 'Swallowed Exception', 'snippet': line.strip()})
                        if '.then(' in line and '.catch(' not in line and '.catch(' not in content: # rough heuristic
                            if 'then(' in line:
                                issues.append({'file': path, 'line': i+1, 'type': 'Unhandled Promise Rejection (Heuristic)', 'snippet': line.strip()})
                        # Check for floating point math on money
                        if re.search(r'Math\.round\([^)]*(tax|disc|subtotal|total|fee)', line, re.IGNORECASE):
                            issues.append({'file': path, 'line': i+1, 'type': 'Floating-Point Currency Math', 'snippet': line.strip()})
    return issues

issues = scan_files('src')
for i in issues:
    print(f"{i['file']}:{i['line']} [{i['type']}] {i['snippet']}")
