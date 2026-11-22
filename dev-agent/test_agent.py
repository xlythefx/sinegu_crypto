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


def test_the_prompt_forbids_pushing_and_private_data():
    from pathlib import Path
    p = agent.build_prompt({"id": 7, "prompt": "why?", "context": {"ticker": "LTCUSDT"}},
                           {"web": Path("C:/w"), "api": Path("C:/a")})
    assert "Do not push" in p and "PUBLIC" in p and "devbot/job-7" in p
    assert "Bash(git push:*)" in agent.DISALLOWED_TOOLS
    assert "Read(**/.env)" in agent.DISALLOWED_TOOLS
