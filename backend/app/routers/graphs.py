"""Save/share of Design Lab node graphs (anonymous, Release 1)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Graph
from ..schemas import GraphCreate, GraphOut

router = APIRouter(prefix="/api/graphs", tags=["graphs"])

MAX_NODES = 500
MAX_EDGES = 2000


@router.post("", response_model=GraphOut, status_code=201)
def create_graph(payload: GraphCreate, db: Session = Depends(get_db)):
    nodes = payload.data.get("nodes")
    edges = payload.data.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise HTTPException(status_code=422, detail="data must contain nodes[] and edges[]")
    if len(nodes) > MAX_NODES or len(edges) > MAX_EDGES:
        raise HTTPException(status_code=422, detail="graph too large")

    graph = Graph(id=uuid.uuid4().hex[:12], data=payload.data)
    db.add(graph)
    db.commit()
    db.refresh(graph)
    return graph


@router.get("/{graph_id}", response_model=GraphOut)
def get_graph(graph_id: str, db: Session = Depends(get_db)):
    graph = db.get(Graph, graph_id)
    if graph is None:
        raise HTTPException(status_code=404, detail="Graph not found")
    return graph
