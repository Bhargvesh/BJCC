with open('app/routes/innovation.py', encoding='utf-8') as f:
    content = f.read()

# The second occurrence search returned -1 char (87189) but count is 2
# Maybe one uses different annotation. Let's search for all variants
import re
matches = [(m.start(), content[m.start():m.start()+80]) for m in re.finditer(r'_I18N_DOC_FIELDS\s*[=:]', content)]
for i, (pos, snip) in enumerate(matches):
    line = content[:pos].count('\n') + 1
    print(f"Match {i+1} at line {line}, char {pos}:")
    print(repr(snip[:60]))
    print()
