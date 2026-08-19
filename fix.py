import re

with open('setup_app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all occurrences of write_file(..., """ with write_file(..., r"""
content = re.sub(r'write_file\((["\'][^"\']+["\']),\s*"""', r'write_file(\1, r"""', content)
content = re.sub(r"write_file\((['\"][^'\"]+['\"]),\s*'''", r"write_file(\1, r'''", content)

with open('setup_app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("setup_app.py updated with raw strings.")
