import re

with open('acceptance-tests.test.ts', 'r') as f:
    content = f.read()

# Fix 1: Add ts column to chunks INSERT when it's missing
# Pattern: INSERT INTO chunks (chunk_id, tenant_id, event_id, text, importance...
# Replace with: INSERT INTO chunks (chunk_id, tenant_id, event_id, ts, text, importance...

pattern1 = r'INSERT INTO chunks \(chunk_id, tenant_id, event_id, text,'
replacement1 = r'INSERT INTO chunks (chunk_id, tenant_id, event_id, ts, text,'
content = re.sub(pattern1, replacement1, content)

# Fix 2: Update VALUES to include NOW() for ts parameter
# Pattern: VALUES ($1, $2, $3, $4, $5,... where $4 is the first value after event_id
# This becomes: VALUES ($1, $2, $3, NOW(), $4, $5,...

# For chunks INSERT specifically
pattern2 = r'(`INSERT INTO chunks \([^)]+\)\s+VALUES \(\$1, \$2, \$3,)\s*\(\$4,'
replacement2 = r'\1 NOW(), \4,'
content = re.sub(pattern2, replacement2, content)

print("Fixed chunks INSERT statements")

with open('acceptance-tests.test.ts', 'w') as f:
    f.write(content)
