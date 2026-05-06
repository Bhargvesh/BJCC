with open('app/routes/innovation.py', encoding='utf-8') as f:
    content = f.read()

# Find both occurrences
first = content.find('_I18N_DOC_FIELDS: Dict[str, Dict[str, Dict[str, Any]]] = {')
second = content.find('_I18N_DOC_FIELDS: Dict[str, Dict[str, Dict[str, Any]]] = {', first + 1)

print(f"First occurrence at char: {first}, line: {content[:first].count(chr(10)) + 1}")
print(f"Second occurrence at char: {second}, line: {content[:second].count(chr(10)) + 1}")

# Find end of first occurrence (where it closes - next top-level function or dict)
# The first occurrence ends just before "_localize_doc_payload" if the old one was there
# OR just before the second _I18N_DOC_FIELDS
snip_first = content[first:first+200]
snip_second = content[second:second+200]
print("\nFirst occurrence snippet:")
print(repr(snip_first[:100]))
print("\nSecond occurrence snippet:")
print(repr(snip_second[:100]))
