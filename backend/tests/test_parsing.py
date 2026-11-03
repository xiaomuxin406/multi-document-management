import io
from docx import Document
from app.services.parsing import parse_document


def test_markdown_preserves_section_and_line_locations():
    chunks = parse_document(
        "note.md", "# 标题\n背景说明\n## Risks\nEvidence can be incomplete.".encode()
    )
    assert chunks[0]["location"].startswith("标题 · 第 1 行")
    assert chunks[1]["location"].startswith("Risks · 第 3 行")
    assert "incomplete" in chunks[1]["text"]


def test_docx_includes_table_content_and_location():
    document = Document()
    document.add_heading("Evidence", 1)
    document.add_paragraph("Results are preliminary.")
    table = document.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "Model"
    table.cell(0, 1).text = "Cost"
    payload = io.BytesIO()
    document.save(payload)
    chunks = parse_document("report.docx", payload.getvalue())
    assert any(
        "preliminary" in item["text"] and "Evidence" in item["location"]
        for item in chunks
    )
    assert any(
        "Model | Cost" in item["text"] and "表格 1" in item["location"]
        for item in chunks
    )
