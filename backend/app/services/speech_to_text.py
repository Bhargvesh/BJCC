import tempfile
import os
from fastapi import UploadFile

try:
    import whisper
except Exception:  # pragma: no cover - optional in demo mode
    whisper = None


class SpeechToTextService:
    def __init__(self):
        self.model = whisper.load_model("base") if whisper else None
    
    async def transcribe_audio(self, audio_file: UploadFile) -> dict:
        """Transcribe audio file to text with language detection"""
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            content = await audio_file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            if not self.model:
                return {
                    "text": "Voice transcription demo mode. Install openai-whisper for real transcription.",
                    "language": "en",
                    "segments": [],
                    "success": True,
                }

            result = self.model.transcribe(temp_path, language=None, task="transcribe")
            
            return {
                "text": result["text"],
                "language": result["language"],
                "segments": result["segments"],
                "success": True
            }
        except Exception as e:
            return {
                "text": "",
                "language": None,
                "error": str(e),
                "success": False
            }
        finally:
            # Clean up temp file
            os.unlink(temp_path)

speech_service = SpeechToTextService()
