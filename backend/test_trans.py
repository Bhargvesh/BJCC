from googletrans import Translator
import asyncio

async def test_trans():
    t = Translator()
    text = "The court ruled in favor of the petitioner."
    for lang in ['hi', 'doi', 'ur', 'ks']:
        try:
            r = await t.translate(text, dest=lang)
            print(f"{lang}: {r.text}")
        except Exception as e:
            print(f"{lang}: error {e}")

asyncio.run(test_trans())
