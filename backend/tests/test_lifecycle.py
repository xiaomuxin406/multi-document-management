import threading
from fastapi.testclient import TestClient
from app.main import create_app
from app.models import ResearchTask
from test_system import signup, project, upload, wait_task


def test_cancelled_worker_cannot_overwrite_status_and_retry_gets_new_id(
    workspace, monkeypatch
):
    client, app = workspace
    signup(client)
    pid = project(client)
    upload(client, pid)
    entered, released = threading.Event(), threading.Event()
    original = app.state.retriever.search

    def blocked_search(*args, **kwargs):
        entered.set()
        assert released.wait(10)
        return original(*args, **kwargs)

    monkeypatch.setattr(app.state.retriever, "search", blocked_search)
    task = client.post(
        f"/api/projects/{pid}/tasks", json={"title": "Agentic RAG"}
    ).json()
    assert entered.wait(10)
    try:
        assert client.post(f"/api/tasks/{task['id']}/cancel").status_code == 200
        retry = client.post(f"/api/tasks/{task['id']}/retry")
        assert retry.status_code == 202
        assert retry.json()["id"] != task["id"]
    finally:
        released.set()
    old = wait_task(client, task["id"])
    assert old["status"] == "cancelled"
    assert old["report_id"] is None
    assert wait_task(client, retry.json()["id"])["status"] == "completed"


def test_restart_marks_interrupted_task_retryable(tmp_path):
    url = f"sqlite:///{tmp_path / 'restart.db'}"
    app = create_app(url, tmp_path, testing=True)
    with TestClient(app) as client:
        signup(client)
        pid = project(client)
        with app.state.sessions() as db:
            task = ResearchTask(project_id=pid, title="Interrupted", status="running")
            db.add(task)
            db.commit()
            task_id = task.id
    restarted = create_app(url, tmp_path, testing=True)
    with TestClient(restarted):
        with restarted.state.sessions() as db:
            task = db.get(ResearchTask, task_id)
            assert task.status == "failed"
            assert task.error
