from backend.demo_limits import DemoBudget


def test_budget_expires_and_is_bounded():
    now = [0.0]
    budget = DemoBudget(limit=2, window=60, clock=lambda: now[0])
    assert budget.allow()
    assert budget.allow()
    assert not budget.allow()
    now[0] = 60
    assert budget.allow()
    assert len(budget.requests) == 1
