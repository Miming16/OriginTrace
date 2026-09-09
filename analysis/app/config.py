import os


DATABASE_URL = os.getenv("DATABASE_URL", "")
JWT_SECRET = os.getenv("JWT_SECRET", "development-only-secret")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
SELF_CHECK_LIMIT = int(os.getenv("SELF_CHECK_LIMIT", "3"))
SUPPORTED_LANGUAGES = {"c", "java", "python", "php"}