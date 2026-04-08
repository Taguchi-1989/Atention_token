from bs4 import BeautifulSoup
from typing import Dict, Optional

class SimpleWebSimulator:
    def __init__(self, initial_html: str):
        self.html = initial_html
        self.soup = BeautifulSoup(initial_html, 'html.parser')
        self.state_changes: Dict[str, str] = {} # Map input_id -> value
        self.submitted: bool = False

    def get_visible_text(self) -> str:
        """Returns a simplified text representation of the screen for the LLM."""
        if self.submitted:
            return "SUCCESS: Your submission has been completed. Thank you."
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
        elif node.name == 'select':
            eid = node.get('id', 'N/A')
            options = [opt.get_text(strip=True) for opt in node.find_all('option')]
            val = self.state_changes.get(eid, "")
            text += f"{prefix}[SELECT id={eid} options={options}] Value='{val}'\n"
        elif node.name == 'button':
            eid = node.get('id', 'N/A')
            text += f"{prefix}[BUTTON id={eid}] {node.get_text(strip=True)}\n"
        
        if hasattr(node, 'children'):
            for child in node.children:
                if child.name:
                    text += self._render_dom(child, depth + 1)
        return text

    def _normalize_target(self, target: str) -> str:
        """Strip common prefixes like 'id=' that LLMs copy from screen output."""
        if target and target.lower().startswith("id="):
            return target[3:]
        return target

    def execute_action(self, action: str, target: str, value: Optional[str] = None) -> bool:
        """
        Updates internal state based on action.
        Returns True if action was 'valid' (element found), False otherwise.
        """
        target = self._normalize_target(target)

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
            element = self.soup.find('button', id=target)
            if not element:
                 element = self.soup.find('a', id=target)

            if element and 'submit' in (target or '').lower():
                self.submitted = True
            return element is not None

        elif action == 'select':
            # simulate dropdown selection
            element = self.soup.find('select', id=target)
            if element:
                self.state_changes[target] = value or ""
                return True
            return False

        return False
