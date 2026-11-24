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
    assert v == {"summary": "Could not reproduce.", "changed": False, "pr_title": "", "pr_body": "", "memory": None}


def test_the_verdict_carries_a_memory_note_even_nested():
    text = ('```json\n{"summary": "Leverage.", "changed": false, "memory": '
            '{"title": "SANTOS max 10x", "body": "Binance allows 10x.", "replaces_id": 4}}\n```')
    assert agent.parse_verdict(text)["memory"] == {"title": "SANTOS max 10x", "body": "Binance allows 10x.", "replaces_id": 4}
    empty = '```json\n{"summary": "x", "memory": {"title": "", "body": "y"}}\n```'
    assert agent.parse_verdict(empty)["memory"] is None


def test_the_prompt_shows_the_memory_and_marks_automatic_jobs():
    from pathlib import Path
    p = agent.build_prompt({"id": 9, "source": "auto", "prompt": "x", "context": {},
                            "memories": [{"id": 4, "title": "SANTOS max 10x", "body": "Binance allows 10x.", "signature": "signal:a"}]},
                           {"web": Path("C:/w"), "api": Path("C:/a")})
    assert "[#4] SANTOS max 10x" in p and "AUTOMATICALLY" in p and "replaces_id" in p


def test_private_strings_are_found_case_insensitively():
    diff = "+ $name = 'jane example';\n+ // account sample-submaster"
    assert agent.find_private(diff, ["Jane Example", "John Sample", "sample-submaster"]) == [
        "Jane Example", "sample-submaster"]
    assert agent.find_private("nothing here", ["Jane Example"]) == []


def test_the_private_check_reads_the_diff_and_message_but_never_the_author(tmp_path):
    import subprocess

    def g(*args):
        subprocess.run(["git", *args], cwd=tmp_path, check=True, capture_output=True)

    g("init", "-q", "-b", "main")
    g("config", "user.name", "Jane Example")
    g("config", "user.email", "jane.example@example.com")
    (tmp_path / "a.txt").write_text("one\n")
    g("add", "-A")
    g("commit", "-q", "-m", "first")
    g("checkout", "-q", "-b", "devbot/job-1")
    (tmp_path / "a.txt").write_text("one\nretry the limiter\n")
    g("commit", "-q", "-am", "Retry a deadlocked limiter write")

    text = agent.outgoing_text(tmp_path, "devbot/job-1")
    assert "retry the limiter" in text and "Retry a deadlocked limiter write" in text
    assert agent.find_private(text, ["Jane Example", "jane.example@example.com"]) == []

    (tmp_path / "a.txt").write_text("one\nretry the limiter\nasked by Jane Example\n")
    g("commit", "-q", "-am", "Name in the diff")
    assert agent.find_private(agent.outgoing_text(tmp_path, "devbot/job-1"), ["Jane Example"]) == ["Jane Example"]


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
