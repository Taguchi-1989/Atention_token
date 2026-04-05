import pytest
from attention_ledger.core.metrics.sus import compute_sus_inspired_score


class TestSUSCalculation:
    """Tests for SUS score calculation."""

    def test_perfect_score(self):
        """All positive responses (odd=5, even=1) should give 100."""
        responses = [5, 1, 5, 1, 5, 1, 5, 1, 5, 1]
        score = compute_sus_inspired_score(responses)
        assert score == 100.0

    def test_worst_score(self):
        """All negative responses (odd=1, even=5) should give 0."""
        responses = [1, 5, 1, 5, 1, 5, 1, 5, 1, 5]
        score = compute_sus_inspired_score(responses)
        assert score == 0.0

    def test_neutral_score(self):
        """All neutral responses (3) should give 50."""
        responses = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
        score = compute_sus_inspired_score(responses)
        assert score == 50.0

    def test_invalid_response_count(self):
        """Should raise ValueError for wrong number of responses."""
        with pytest.raises(ValueError):
            compute_sus_inspired_score([1, 2, 3])  # Too few
        with pytest.raises(ValueError):
            compute_sus_inspired_score([1] * 11)  # Too many

    def test_invalid_response_value(self):
        """Should raise ValueError for out-of-range values."""
        with pytest.raises(ValueError):
            compute_sus_inspired_score([0, 3, 3, 3, 3, 3, 3, 3, 3, 3])  # 0 is invalid
        with pytest.raises(ValueError):
            compute_sus_inspired_score([6, 3, 3, 3, 3, 3, 3, 3, 3, 3])  # 6 is invalid

    def test_empty_responses(self):
        """Should raise ValueError for empty list."""
        with pytest.raises(ValueError):
            compute_sus_inspired_score([])
