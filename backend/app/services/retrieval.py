import hashlib
import math
import re
import threading
from collections import Counter
from sqlalchemy import select
from ..models import Chunk, Document


def tokenize(text):
    words = re.findall(r"[a-z0-9_]+", text.lower())
    for group in re.findall(r"[\u4e00-\u9fff]+", text):
        words.extend(group)
        words.extend(group[i : i + 2] for i in range(len(group) - 1))
    return words


def lexical_vector(text, dimensions=384):
    vector = [0.0] * dimensions
    for term, count in Counter(tokenize(text)).items():
        raw = hashlib.sha256(term.encode()).digest()
        index = int.from_bytes(raw[:4], "big") % dimensions
        vector[index] += (1 + math.log(count)) * (1 if raw[4] & 1 else -1)
    norm = math.sqrt(sum(value * value for value in vector)) or 1
    return [value / norm for value in vector]


class HybridRetriever:
    """Persistent Chroma lexical vectors + bilingual BM25. No model download implied."""

    def __init__(self, sessions, directory, embedding=None):
        import chromadb
        from chromadb.config import Settings

        self.sessions, self.lock = sessions, threading.RLock()
        self.embedding = embedding
        self.client = chromadb.PersistentClient(
            path=str(directory), settings=Settings(anonymized_telemetry=False)
        )
        identity = (
            hashlib.sha256(
                (embedding.base_url + "/" + embedding.model).encode()
            ).hexdigest()[:16]
            if embedding
            else "lexical_v1"
        )
        self.collection = self.client.get_or_create_collection(
            "chunks_" + identity, metadata={"hnsw:space": "cosine"}
        )

    def index(self, chunks):
        with self.lock:
            for start in range(0, len(chunks), 100):
                batch = chunks[start : start + 100]
                vectors = (
                    self.embedding.embed([c.text for c in batch])
                    if self.embedding
                    else [lexical_vector(c.text) for c in batch]
                )
                self.collection.upsert(
                    ids=[c.id for c in batch],
                    embeddings=vectors,
                    metadatas=[
                        {"project_id": c.project_id, "document_id": c.document_id}
                        for c in batch
                    ],
                )

    def remove_document(self, document_id):
        with self.lock:
            self.collection.delete(where={"document_id": document_id})

    def search(self, project_id, query, limit=8):
        from rank_bm25 import BM25Okapi

        with self.sessions() as db:
            rows = db.execute(
                select(Chunk, Document.name)
                .join(Document, Chunk.document_id == Document.id)
                .where(Chunk.project_id == project_id, Document.status == "ready")
            ).all()
        if not rows:
            return []
        query_terms = set(tokenize(query))
        if not query_terms:
            return []
        # Exact DB membership remains the source of truth even if an index update was interrupted.
        row_map = {chunk.id: (chunk, name) for chunk, name in rows}
        scores = Counter()
        tokens = [tokenize(chunk.text) for chunk, _ in rows]
        bm25 = BM25Okapi(tokens).get_scores(list(query_terms))
        candidates = [
            i
            for i, term_list in enumerate(tokens)
            if query_terms.intersection(term_list)
        ]
        for rank, index in enumerate(
            sorted(candidates, key=lambda i: float(bm25[i]), reverse=True)
        ):
            scores[rows[index][0].id] += 1 / (60 + rank)
        with self.lock:
            vector = (
                self.embedding.embed([query])[0]
                if self.embedding
                else lexical_vector(query)
            )
            result = self.collection.query(
                query_embeddings=[vector],
                where={"project_id": project_id},
                n_results=min(limit * 2, len(rows)),
            )
        for rank, chunk_id in enumerate(result["ids"][0]):
            if chunk_id in row_map and (
                self.embedding
                or query_terms.intersection(tokenize(row_map[chunk_id][0].text))
            ):
                scores[chunk_id] += 1 / (60 + rank)
        return [
            dict(
                id=chunk_id,
                title=row_map[chunk_id][1],
                text=row_map[chunk_id][0].text,
                location=row_map[chunk_id][0].location,
                document_id=row_map[chunk_id][0].document_id,
                url=None,
                source_type="document",
                score=round(min(score * 30, 1), 4),
            )
            for chunk_id, score in scores.most_common(limit)
        ]
