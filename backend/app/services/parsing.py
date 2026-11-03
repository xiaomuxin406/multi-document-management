import io
import re
import zipfile
from pathlib import Path
from pypdf import PdfReader
from docx import Document

ALLOWED = {".pdf", ".docx", ".md", ".markdown", ".txt"}


def split_text(text, location, size=1000):
    text = text.replace("\x00", "").strip()
    if not text:
        return []
    result = []
    for start in range(0, len(text), size - 120):
        part = text[start : start + size].strip()
        if part:
            result.append(
                {
                    "text": part,
                    "location": location[:220] + f" · 片段 {len(result) + 1}",
                }
            )
        if start + size >= len(text):
            break
    return result


def parse_document(name, payload):
    suffix = Path(name).suffix.lower()
    if suffix not in ALLOWED:
        raise ValueError("仅支持 PDF、DOCX、Markdown 和 TXT 文件")
    chunks = []
    if suffix == ".pdf":
        reader = PdfReader(io.BytesIO(payload))
        if reader.is_encrypted:
            raise ValueError("加密 PDF 请先解密后上传")
        if len(reader.pages) > 1500:
            raise ValueError("单个 PDF 最多支持 1500 页，请拆分文件")
        for index, page in enumerate(reader.pages):
            chunks.extend(split_text(page.extract_text() or "", f"第 {index + 1} 页"))
        if not chunks:
            raise ValueError("未提取到可用文本。扫描 PDF 需要先进行 OCR")
    elif suffix == ".docx":
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            if sum(item.file_size for item in archive.infolist()) > 100 * 1024 * 1024:
                raise ValueError("DOCX 解压后体积过大")
        doc = Document(io.BytesIO(payload))
        heading = "正文"
        for index, paragraph in enumerate(doc.paragraphs):
            if paragraph.style and paragraph.style.name.startswith("Heading"):
                heading = paragraph.text[:120]
            chunks.extend(split_text(paragraph.text, f"{heading} · 段落 {index + 1}"))
        for index, table in enumerate(doc.tables):
            text = "\n".join(
                " | ".join(cell.text for cell in row.cells) for row in table.rows
            )
            chunks.extend(split_text(text, f"表格 {index + 1}"))
    else:
        try:
            text = payload.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                text = payload.decode("gb18030")
            except UnicodeDecodeError:
                raise ValueError("文本编码无法识别，请使用 UTF-8")
        heading = "正文"
        block, start_line = [], 1
        for number, line in enumerate(text.splitlines(), 1):
            if re.match(r"^#{1,6}\s+", line):
                chunks.extend(
                    split_text("\n".join(block), f"{heading} · 第 {start_line} 行")
                )
                heading, block, start_line = (
                    re.sub(r"^#+\s*", "", line)[:120],
                    [line],
                    number,
                )
            else:
                block.append(line)
        chunks.extend(split_text("\n".join(block), f"{heading} · 第 {start_line} 行"))
    if not chunks:
        raise ValueError("文档没有可用正文")
    if len(chunks) > 10000:
        raise ValueError("单文件文本块超过 10000，请拆分文件")
    return chunks
