import pytest

from plane.db.models.state import DEFAULT_STATES, StateGroup


@pytest.mark.unit
def test_default_state_names_are_unique():
    names = [state["name"] for state in DEFAULT_STATES]
    assert len(names) == len(set(names))


@pytest.mark.unit
def test_default_states_cover_each_group_once():
    groups = [state["group"] for state in DEFAULT_STATES]
    assert len(groups) == len(set(groups))
    assert set(groups) == set(StateGroup.values)
    assert sum(state.get("default", False) for state in DEFAULT_STATES) == 1
