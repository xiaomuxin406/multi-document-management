import io
import re
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import update as sql_update
from ..auth import current_user, db_session
from ..models import Report, ReportRevision, now
from ..schemas import ReportInput
from .common import own_report, serialize

router = APIRouter(tags=["reports"])


@router.get("/reports/{report_id}")
def detail(report_id: str, user=Depends(current_user), db=Depends(db_session)):
    return serialize(own_report(db, report_id, user))


@router.put("/reports/{report_id}")
def update(
    report_id: str,
    body: ReportInput,
    user=Depends(current_user),
    db=Depends(db_session),
):
    report = own_report(db, report_id, user)
    next_version = body.expected_version + 1
    changed = db.execute(
        sql_update(Report)
        .where(Report.id == report.id, Report.version == body.expected_version)
        .values(version=next_version, content=body.content, updated_at=now())
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(
            409, "报告已被其他窗口修改，请刷新后重新编辑；当前输入尚未保存"
        )
    db.add(
        ReportRevision(report_id=report.id, version=next_version, content=body.content)
    )
    db.commit()
    db.refresh(report)
    return serialize(report)


@router.get("/reports/{report_id}/export")
def export(
    report_id: str,
    format: str = "md",
    user=Depends(current_user),
    db=Depends(db_session),
):
    report = own_report(db, report_id, user)
    name = re.sub(r'[\x00-\x1f<>:"/\\|?*]', "_", report.title)[:100]
    if format == "md":
        payload, media_type = (
            report.content.encode("utf-8"),
            "text/markdown; charset=utf-8",
        )
    elif format == "docx":
        from docx import Document
        from docx.shared import Pt
        from docx.oxml.ns import qn

        doc = Document()
        normal = doc.styles["Normal"]
        normal.font.name, normal.font.size = "Calibri", Pt(11)
        normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
        for line in report.content.splitlines():
            heading = re.match(r"^(#{1,6})\s+(.*)", line)
            if heading:
                doc.add_heading(heading.group(2), level=min(len(heading.group(1)), 4))
            elif line.startswith("- "):
                doc.add_paragraph(line[2:], style="List Bullet")
            elif line.strip():
                doc.add_paragraph(line.removeprefix("> "))
        target = io.BytesIO()
        doc.save(target)
        payload, media_type = (
            target.getvalue(),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    else:
        raise HTTPException(400, "仅支持 md 或 docx")
    return Response(
        payload,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename=report.{format}; filename*=UTF-8''{quote(name)}.{format}"
        },
    )
