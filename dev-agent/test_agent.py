"""The developer agent's pure parts: reading Claude's verdict, the private-data check."""
import agent


def test_the_last_json_block_is_the_verdict():
    text = 'thinking...\n```json\n{"summary": "old"}\n```\nmore\n```json\n{"summary": "LTC skipped: master full.", "changed": false}\n```'
    v = agent.parse_verdict(text)
    assert v["summary"] == "LTC skipped: master full."
    assert v["changed"] is False
    assert v["pr_title"] == ""


def test_no_json_falls_back_to_the_text():
    v = agent.parse_verdict("Could not reproduce.")
    assert v == {"summary": "Could not reproduce.", "changed": False, "pr_title": "", "pr_body": ""}


def test_private_strings_are_found_case_insensitively():
    diff = "+ $name = 'alexandre guyomard';\n+ // account dima-submaster"
    assert agent.find_private(diff, ["Alexandre Guyomard", "Lloyd Example", "dima-submaster"]) == [
        "Alexandre Guyomard", "dima-submaster"]
    assert agent.find_private("nothing here", ["Alexandre Guyomard"]) == []


def test_deploy_plan_uses_full_for_both_and_adds_engine_steps():
    assert agent.deploy_plan(["website", "api"]) == (["web", "api"], [["full"]])
    assert agent.deploy_plan(["api"]) == (["web", "api"], [["backup"], ["deploy-api"], ["verify"]])
    assert agent.deploy_plan(["website", "engine"]) == (
        ["web"], [["backup"], ["deploy-dash"], ["verify"], ["deploy-engine"], ["verify-engine"]])
    assert agent.deploy_plan([]) == ([], [])


def test_unsafe_changes_block_what_would_ship_by_accident():
    status = " M src/App.tsx\n?? .cloude-remote.vite.config.mjs\n?? src/new.tsx\n?? notes.txt\n"
    assert agent.unsafe_changes("web", status) == [" M src/App.tsx", "?? src/new.tsx"]
    assert agent.unsafe_changes("api", "?? scratch.php\n") == ["?? scratch.php"]
    assert agent.unsafe_changes("web", "") == []


def test_the_prompt_forbids_pushing_and_private_data():
    from pathlib import Path
    p = agent.build_prompt({"id": 7, "prompt": "why?", "context": {"ticker": "LTCUSDT"}},
                           {"web": Path("C:/w"), "api": Path("C:/a")})
    assert "Do not push" in p and "PUBLIC" in p and "devbot/job-7" in p
    assert "Bash(git push:*)" in agent.DISALLOWED_TOOLS
    assert "Read(**/.env)" in agent.DISALLOWED_TOOLS
