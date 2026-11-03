from app.services.research import coverage_assessment, validate_citations


def test_no_evidence_never_means_sufficient():
    result = coverage_assessment(["性能", "成本"], [])
    assert result["coverage"] == 0
    assert result["gaps"] == ["性能", "成本"]


def test_duplicate_source_does_not_erase_uncovered_question():
    evidence = [
        {"text": "性能显著提升", "document_id": "same", "id": "E1"},
        {"text": "性能显著提升", "document_id": "same", "id": "E2"},
    ]
    result = coverage_assessment(["性能", "成本"], evidence)
    assert result["coverage"] == 0.5
    assert result["gaps"] == ["成本"]


def test_unknown_citations_are_rejected():
    assert validate_citations("Claim [E1]", [{"id": "E1"}])
    assert not validate_citations("Claim [E9]", [{"id": "E1"}])
    assert not validate_citations("Unsupported report", [{"id": "E1"}])
