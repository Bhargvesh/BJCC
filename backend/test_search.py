import httpx, json

r = httpx.get('http://127.0.0.1:8010/api/innovation/judicial/search?q=right+to+privacy', timeout=30)
data = r.json()
print('Status:', r.status_code)
print('Total results:', data.get('total'))
print('Sources used:', json.dumps(data.get('sources_used'), indent=2))
results = data.get('results', [])
for i, res in enumerate(results[:5]):
    title = res.get('title', '')[:70]
    court = res.get('court', '')
    print(f'  [{i+1}] {title} | {court}')
