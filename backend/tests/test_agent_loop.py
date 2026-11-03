import json
from sqlalchemy import select
from app.models import ResearchTask, TaskEvent, Report
from app.services.research import ResearchRunner
from test_system import signup, project


class ScriptedLLM:
    """Deterministic external boundary; real LangGraph and persistence run unchanged."""

    def __init__(self):
        self.evaluations = 0

    def complete(self, system, payload, json_output=False):
        operation = payload["operation"]
        if operation.startswith("Plan"):
            return json.dumps(
                {"outline": ["performance", "cost"], "queries": ["agent research"]}
            )
        if operation.startswith("For each"):
            self.evaluations += 1
            return json.dumps(
                {
                    "assessments": [
                        {
                            "question": "performance",
                            "supported_by": ["E1"],
                            "adequate": True,
                        },
                        {
                            "question": "cost",
                            "supported_by": ["E2"] if self.evaluations > 1 else [],
                            "adequate": self.evaluations > 1,
                            "gap": "cost",
                        },
                    ],
                    "conflicts": [],
                }
            )
        return "# Research\n\nPerformance evidence [E1]. Cost evidence [E2]."


class ScriptedSearch:
    def search(self, query, limit):
        second = "cost" in query
        return [
            {
                "title": "Cost" if second else "Performance",
                "text": "cost data" if second else "performance data",
                "location": "search snippet",
                "url": "https://example.org/cost"
                if second
                else "https://example.org/performance",
                "source_type": "web",
                "document_id": None,
                "score": 0.9,
            }
        ]


def test_agent_retrieves_again_for_actual_gap_and_preserves_sources(workspace):
    client, app = workspace
    signup(client)
    pid = project(client)
    with app.state.sessions() as db:
        task = ResearchTask(
            project_id=pid,
            title="Agent research",
            web_enabled=True,
            max_rounds=3,
            mode="llm",
        )
        db.add(task)
        db.commit()
        task_id = task.id
    ResearchRunner(
        app.state.sessions,
        app.state.retriever,
        ScriptedLLM(),
        ScriptedSearch(),
        task_id,
    ).run()
    with app.state.sessions() as db:
        task = db.get(ResearchTask, task_id)
        assert task.status == "completed"
        assert task.round == 2
        assert task.coverage == 1
        assert task.gaps == []
        report = db.get(Report, task.report_id)
        assert len(report.evidence) == 2
        assert "https://example.org/cost" in report.content
        events = db.scalars(select(TaskEvent).where(TaskEvent.task_id == task_id)).all()
        assert any(
            event.data.get("queries") == ["Agent research cost"] for event in events
        )


def test_unknown_model_citations_fail_without_publishing_report(workspace):
    client, app = workspace
    signup(client)
    pid = project(client)

    class BrokenLLM(ScriptedLLM):
        def complete(self, system, payload, json_output=False):
            if payload["operation"].startswith("Write"):
                return "Invented claim [E999]"
            return super().complete(system, payload, json_output)

    with app.state.sessions() as db:
        task = ResearchTask(
            project_id=pid,
            title="Agent research",
            web_enabled=True,
            max_rounds=1,
            mode="llm",
        )
        db.add(task)
        db.commit()
        task_id = task.id
    ResearchRunner(
        app.state.sessions, app.state.retriever, BrokenLLM(), ScriptedSearch(), task_id
    ).run()
    with app.state.sessions() as db:
        task = db.get(ResearchTask, task_id)
        assert task.status == "failed"
        assert task.report_id is None
        assert "引用" in task.error


def test_conflict_only_evaluation_triggers_real_followup_search(workspace):
    client, app = workspace
    signup(client)
    pid = project(client)

    class ConflictLLM(ScriptedLLM):
        def complete(self, system, payload, json_output=False):
            if payload["operation"].startswith("For each"):
                self.evaluations += 1
                return json.dumps(
                    {
                        "assessments": [
                            {"question": q, "supported_by": ["E1"], "adequate": True}
                            for q in payload["questions"]
                        ],
                        "conflicts": ["cost differs across sources"]
                        if self.evaluations == 1
                        else [],
                    }
                )
            if payload["operation"].startswith("Write"):
                return "Findings [E1]"
            return super().complete(system, payload, json_output)

    class RecordingSearch(ScriptedSearch):
        queries = []

        def search(self, query, limit):
            self.queries.append(query)
            return super().search(query, limit)

    search = RecordingSearch()
    with app.state.sessions() as db:
        task = ResearchTask(
            project_id=pid,
            title="Agent research",
            web_enabled=True,
            max_rounds=3,
            mode="llm",
        )
        db.add(task)
        db.commit()
        task_id = task.id
    ResearchRunner(
        app.state.sessions, app.state.retriever, ConflictLLM(), search, task_id
    ).run()
    assert any("cost differs across sources" in query for query in search.queries)


def test_environment_embedding_is_authoritative_after_config_change(workspace):
    from app.api.common import system_settings
    from app.models import SystemSetting

    client, app = workspace
    with app.state.sessions() as db:
        db.add(
            SystemSetting(
                key="providers",
                value={"embedding_model": "old-embedding", "llm_model": "custom"},
            )
        )
        db.commit()
        app.state.settings.embedding_model = "new-embedding"
        settings = system_settings(db, app.state.settings)
        assert settings["embedding_model"] == "new-embedding"
        assert settings["llm_model"] == "custom"
