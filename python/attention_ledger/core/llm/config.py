class Settings:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Settings, cls).__new__(cls)
            cls._instance.ollama_url = "http://localhost:11434"
            cls._instance.model_name = "llama3"
            cls._instance.temperature = 0.7
        return cls._instance


settings = Settings()
