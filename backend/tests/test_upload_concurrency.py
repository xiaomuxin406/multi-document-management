import asyncio
import threading
import httpx
from app.main import create_app


def test_upload_does_not_block_other_requests(tmp_path, monkeypatch):
    from app.api import documents

    app = create_app(f"sqlite:///{tmp_path / 'concurrency.db'}", tmp_path, testing=True)
    entered, released = threading.Event(), threading.Event()
    original = documents.parse_document

    def slow_parser(*args):
        entered.set()
        assert released.wait(5)
        return original(*args)

    monkeypatch.setattr(documents, "parse_document", slow_parser)

    async def scenario():
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test"
            ) as client:
                await client.post(
                    "/api/auth/setup",
                    json={
                        "name": "A",
                        "email": "a@example.com",
                        "password": "StrongPass123!",
                    },
                )
                project = (
                    await client.post("/api/projects", json={"name": "Concurrency"})
                ).json()
                request = asyncio.create_task(
                    client.post(
                        f"/api/projects/{project['id']}/documents",
                        files={"files": ("a.md", b"# data")},
                    )
                )
                try:
                    await asyncio.wait_for(asyncio.to_thread(entered.wait, 2), 3)
                    response = await asyncio.wait_for(client.get("/api/health"), 0.5)
                    assert response.status_code == 200
                finally:
                    released.set()
                    result = await request
                assert result.json()[0]["status"] == "ready"

    asyncio.run(scenario())
