"""Save/share of Design Lab node graphs. Anonymous share links (Release 1) plus
account-owned graphs with rename/update/delete (Release 2)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Graph, User
from ..schemas import GraphCreate, GraphOut, GraphSummary, GraphUpdate
from .auth import get_current_user, get_optional_user

router = APIRouter(prefix="/api/graphs", tags=["graphs"])

MAX_NODES = 500
MAX_EDGES = 2000


def _validate_graph_data(data: dict) -> None:
    nodes = data.get("nodes")
    edges = data.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise HTTPException(status_code=422, detail="data must contain nodes[] and edges[]")
    if len(nodes) > MAX_NODES or len(edges) > MAX_EDGES:
        raise HTTPException(status_code=422, detail="graph too large")


def _owned_or_404(graph_id: str, db: Session, user: User) -> Graph:
    """Fetch a graph the user owns, or 404. Not-owned reads as not-found so a user can
    never probe or touch someone else's (or an anonymous) graph."""
    graph = db.get(Graph, graph_id)
    if graph is None or graph.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Graph not found")
    return graph


@router.post("", response_model=GraphOut, status_code=201)
def create_graph(
    payload: GraphCreate,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    _validate_graph_data(payload.data)

    # Signed-in saves are owned (and appear in the gallery); anonymous saves stay ownerless
    # and remain shareable exactly as in Release 1.
    graph = Graph(
        id=uuid.uuid4().hex[:12],
        data=payload.data,
        owner_id=user.id if user else None,
        title=(payload.title.strip() or None) if payload.title else None,
    )
    db.add(graph)
    db.commit()
    db.refresh(graph)
    return graph


@router.get("/mine", response_model=list[GraphSummary])
def my_graphs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(Graph)
        .filter(Graph.owner_id == user.id)
        .order_by(Graph.updated_at.desc())
        .all()
    )


@router.get("/{graph_id}", response_model=GraphOut)
def get_graph(graph_id: str, db: Session = Depends(get_db)):
    graph = db.get(Graph, graph_id)
    if graph is None:
        raise HTTPException(status_code=404, detail="Graph not found")
    return graph


@router.patch("/{graph_id}", response_model=GraphOut)
def update_graph(
    graph_id: str,
    payload: GraphUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Rename and/or overwrite one of the current user's own graphs (update-in-place)."""
    graph = _owned_or_404(graph_id, db, user)
    if payload.data is not None:
        _validate_graph_data(payload.data)
        graph.data = payload.data
    if payload.title is not None:
        graph.title = payload.title.strip() or None
    db.commit()
    db.refresh(graph)
    return graph


@router.delete("/{graph_id}", status_code=204)
def delete_graph(
    graph_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    graph = _owned_or_404(graph_id, db, user)
    db.delete(graph)
    db.commit()
    return Response(status_code=204)
