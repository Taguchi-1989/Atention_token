from typing import List

def compute_sus_inspired_score(responses: List[int]) -> float:
    """
    Computes the System Usability Scale (SUS) score.
    
    Args:
        responses: A list of 10 integers (1-5), representing answers to the 10 SUS questions.
        
    Returns:
        float: The calculated SUS score (0-100).
        
    Raises:
        ValueError: If responses list is not valid (length 10, values 1-5).
    """
    if not responses or len(responses) != 10:
        raise ValueError("SUS require exactly 10 responses.")
        
    if any(r < 1 or r > 5 for r in responses):
        raise ValueError("SUS responses must be between 1 and 5.")

    score = 0
    for i, answer in enumerate(responses):
        idx = i + 1
        if idx % 2 != 0: # Odd questions (1, 3, 5, 7, 9)
            score += (answer - 1)
        else: # Even questions (2, 4, 6, 8, 10)
            score += (5 - answer)
            
    return score * 2.5
