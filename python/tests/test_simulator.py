import pytest
from attention_ledger.core.execute.simulator import SimpleWebSimulator


class TestSimpleWebSimulator:
    """Tests for the web simulator."""

    @pytest.fixture
    def sample_html(self):
        return """
        <!DOCTYPE html>
        <html>
        <body>
            <h1>Test Form</h1>
            <label for="name">Name:</label>
            <input type="text" id="name" placeholder="Enter name" />
            <input type="number" id="amount" placeholder="100" />
            <button id="submit_btn">Submit</button>
        </body>
        </html>
        """

    def test_init(self, sample_html):
        """Simulator should initialize with HTML."""
        sim = SimpleWebSimulator(sample_html)
        assert sim is not None

    def test_get_visible_text(self, sample_html):
        """Should return text representation of screen."""
        sim = SimpleWebSimulator(sample_html)
        text = sim.get_visible_text()
        assert "Test Form" in text
        assert "name" in text.lower()
        assert "submit" in text.lower()

    def test_execute_input_action(self, sample_html):
        """Input action should update state."""
        sim = SimpleWebSimulator(sample_html)
        result = sim.execute_action("input", "name", "John Doe")
        assert result is True
        assert sim.state_changes.get("name") == "John Doe"

    def test_execute_click_action(self, sample_html):
        """Click action on existing button should succeed."""
        sim = SimpleWebSimulator(sample_html)
        result = sim.execute_action("click", "submit_btn")
        assert result is True

    def test_execute_action_nonexistent_element(self, sample_html):
        """Action on nonexistent element should fail."""
        sim = SimpleWebSimulator(sample_html)
        result = sim.execute_action("input", "nonexistent_field", "value")
        assert result is False

    def test_state_persists_across_actions(self, sample_html):
        """State changes should persist."""
        sim = SimpleWebSimulator(sample_html)
        sim.execute_action("input", "name", "Alice")
        sim.execute_action("input", "amount", "500")
        
        assert sim.state_changes["name"] == "Alice"
        assert sim.state_changes["amount"] == "500"
        
        # Updated text should show new values
        text = sim.get_visible_text()
        assert "Alice" in text or "500" in text
