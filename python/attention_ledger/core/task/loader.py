import yaml
from typing import List
from pathlib import Path
from .model import TaskScenario

class TaskLoader:
    @staticmethod
    def load_from_file(file_path: str) -> TaskScenario:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Task file not found: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            
        return TaskScenario(**data)

    @staticmethod
    def load_all_from_dir(dir_path: str) -> List[TaskScenario]:
        path = Path(dir_path)
        if not path.exists() or not path.is_dir():
            raise ValueError(f"Directory not found: {dir_path}")
            
        tasks = []
        for file in path.glob("*.yaml"):
            try:
                tasks.append(TaskLoader.load_from_file(str(file)))
            except Exception as e:
                print(f"Warning: Failed to load task from {file}: {e}")
        return tasks
