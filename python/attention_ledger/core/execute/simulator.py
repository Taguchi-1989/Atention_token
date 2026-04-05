from bs4 import BeautifulSoup
from typing import Dict, Optional

class SimpleWebSimulator:
    def __init__(self, initial_html: str):
        self.html = initial_html
        self.soup = BeautifulSoup(initial_html, 'html.parser')
        self.state_changes: Dict[str, str] = {} # Map input_id -> value

    def get_visible_text(self) -> str:
        """Returns a simplified text representation of the screen for the LLM."""
        body = self.soup.body
        if not body:
            return "Empty page"
        return self._render_dom(body)

    def _render_dom(self, node, depth=0) -> str:
        text = ""
        prefix = "  " * depth
        
        if node.name in ['script', 'style']:
            return ""
            
        if node.string and node.string.strip():
            text += f"{prefix}{node.string.strip()}\n"
            
        if node.name == 'input':
            eid = node.get('id', 'N/A')
            val = self.state_changes.get(eid, "")
            text += f"{prefix}[INPUT id={eid} placeholder='{node.get('placeholder','')}'] Value='{val}'\n"
        elif node.name == 'button':
            eid = node.get('id', 'N/A')
            text += f"{prefix}[BUTTON id={eid}] {node.get_text(strip=True)}\n"
        
        if hasattr(node, 'children'):
            for child in node.children:
                if child.name:
                    text += self._render_dom(child, depth + 1)
        return text

    def execute_action(self, action: str, target: str, value: Optional[str] = None) -> bool:
        """
        Updates internal state based on action.
        Returns True if action was 'valid' (element found), False otherwise.
        """
        if action == 'input':
            # simulate typing
            element = self.soup.find('input', id=target)
            if not element:
                element = self.soup.find('textarea', id=target)
            
            if element:
                self.state_changes[target] = value or ""
                return True
            return False
            
        elif action == 'click':
            # simulate click
            # If submit button, maybe we transition state?
            # For MVP, we just verify the button exists
            element = self.soup.find('button', id=target)
            if not element:
                 element = self.soup.find('a', id=target)
            
            return element is not None

        return False
