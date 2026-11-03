import time
import pytest
from fastapi.testclient import TestClient
from app.main import create_app


@pytest.fixture
def workspace(tmp_path):
    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        data_dir=tmp_path,
        testing=True,
    )
    with TestClient(app) as client:
        yield client, app


def signup(client, email="admin@example.com", setup=True):
    response = client.post(
        "/api/auth/setup" if setup else "/api/auth/register",
        json={"name": "研究员", "email": email, "password": "StrongPass123!"},
    )
    assert response.status_code in (200, 201), response.text
    return response.json()


def project(client):
    response = client.post(
        "/api/projects", json={"name": "双语研究", "description": "测试"}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def upload(client, pid, text=None):
    return client.post(
        f"/api/projects/{pid}/documents",
        files=[
            (
                "files",
                (
                    "研究.md",
                    (
                        text
                        or "# Agentic RAG\n\n自主检索需要评估信息覆盖率与证据来源。\n\n## Limitations\nAgentic retrieval requires bounded iterations. Evidence must support report claims."
                    ).encode(),
                    "text/markdown",
                ),
            )
        ],
    )


def wait_task(client, task_id):
    for _ in range(100):
        result = client.get(f"/api/tasks/{task_id}").json()
        if result["status"] in ("completed", "failed", "cancelled"):
            return result
        time.sleep(0.05)
    pytest.fail("task did not finish")


def test_initial_admin_is_one_time_and_member_cannot_escalate(workspace):
    client, _ = workspace
    assert client.get("/api/auth/status").json() == {"setup_required": True}
    assert signup(client)["role"] == "admin"
    assert (
        client.post(
            "/api/auth/setup",
            json={"name": "x", "email": "x@x.com", "password": "StrongPass123!"},
        ).status_code
        == 409
    )
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    member = signup(client, "member@example.com", False)
    assert member["role"] == "member"
    assert client.get("/api/admin/users").status_code == 403
    assert client.put("/api/admin/settings", json={"llm_model": "x"}).status_code == 403


def test_project_document_task_report_are_owner_isolated(workspace):
    client, _ = workspace
    signup(client)
    pid = project(client)
    doc = upload(client, pid).json()[0]
    task_response = client.post(
        f"/api/projects/{pid}/tasks",
        json={"title": "Agentic RAG", "web_enabled": False},
    )
    assert task_response.status_code == 202, task_response.text
    task = wait_task(client, task_response.json()["id"])
    assert task["status"] == "completed", task
    rid = task["report_id"]
    client.post("/api/auth/logout")
    signup(client, "other@example.com", False)
    assert client.get("/api/projects").json() == []
    for path in (
        f"/api/projects/{pid}/documents",
        f"/api/documents/{doc['id']}",
        f"/api/tasks/{task['id']}",
        f"/api/reports/{rid}",
    ):
        assert client.get(path).status_code == 404, path
    assert client.delete(f"/api/documents/{doc['id']}").status_code == 404


def test_upload_research_citations_and_versioned_export(workspace):
    client, _ = workspace
    signup(client)
    pid = project(client)
    result = upload(client, pid)
    assert result.status_code == 201, result.text
    doc = result.json()[0]
    assert doc["status"] == "ready"
    assert doc["chunk_count"] > 0
    detail = client.get(f"/api/documents/{doc['id']}").json()
    assert detail["chunks"][0]["location"]
    task = client.post(
        f"/api/projects/{pid}/tasks",
        json={"title": "Agentic RAG 自主检索", "web_enabled": False, "max_rounds": 2},
    ).json()
    finished = wait_task(client, task["id"])
    assert finished["status"] == "completed", finished
    assert finished["mode"] == "extractive"
    assert 0 <= finished["coverage"] <= 1
    assert finished["events"] and finished["evidence"]
    report = client.get(f"/api/reports/{finished['report_id']}").json()
    assert "[E1]" in report["content"]
    assert "本地" in report["content"]
    updated = client.put(
        f"/api/reports/{report['id']}",
        json={
            "content": report["content"] + "\n人工补充",
            "expected_version": report["version"],
        },
    ).json()
    assert updated["version"] == 2
    stale = client.put(
        f"/api/reports/{report['id']}",
        json={"content": "stale tab", "expected_version": 1},
    )
    assert stale.status_code == 409
    assert (
        "人工补充" in client.get(f"/api/reports/{report['id']}/export?format=md").text
    )
    exported = client.get(f"/api/reports/{report['id']}/export?format=docx")
    assert exported.status_code == 200 and exported.content[:2] == b"PK"


def test_upload_validation_and_last_admin_protection(workspace):
    client, _ = workspace
    admin = signup(client)
    pid = project(client)
    assert (
        client.post(
            f"/api/projects/{pid}/documents", files={"files": ("bad.exe", b"data")}
        ).status_code
        == 400
    )
    assert (
        client.patch(
            f"/api/admin/users/{admin['id']}", json={"is_active": False}
        ).status_code
        == 409
    )
    assert (
        client.patch(
            f"/api/admin/users/{admin['id']}", json={"role": "member"}
        ).status_code
        == 409
    )
    assert (
        client.put(
            "/api/admin/settings", json={"llm_base_url": "file:///etc"}
        ).status_code
        == 422
    )
    assert "api_key" not in client.get("/api/admin/settings").text.lower()


def test_deleted_document_not_returned_by_retrieval(workspace):
    client, app = workspace
    signup(client)
    pid = project(client)
    doc = upload(client, pid).json()[0]
    assert app.state.retriever.search(pid, "Agentic")
    assert client.delete(f"/api/documents/{doc['id']}").status_code == 200
    assert app.state.retriever.search(pid, "Agentic") == []


def test_missing_web_credentials_stops_with_actionable_error(workspace):
    client, _ = workspace
    signup(client)
    pid = project(client)
    response = client.post(
        f"/api/projects/{pid}/tasks", json={"title": "联网调研", "web_enabled": True}
    )
    assert response.status_code == 409
    assert "TAVILY_API_KEY" in response.json()["detail"]


def test_csrf_allows_configured_dev_proxy_and_rejects_other_origins(workspace):
    client, _ = workspace
    body = {"name": "研究员", "email": "csrf@example.com", "password": "StrongPass123!"}
    assert (
        client.post(
            "/api/auth/setup", json=body, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/auth/setup", json=body, headers={"Origin": "http://127.0.0.1:5173"}
        ).status_code
        == 201
    )


def test_active_research_prevents_document_deletion(workspace):
    from app.models import ResearchTask

    client, app = workspace
    signup(client)
    pid = project(client)
    doc = upload(client, pid).json()[0]
    with app.state.sessions() as db:
        db.add(ResearchTask(project_id=pid, title="Running", status="running"))
        db.commit()
    assert client.delete(f"/api/documents/{doc['id']}").status_code == 409
