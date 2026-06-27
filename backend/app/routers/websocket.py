from fastapi import WebSocket, WebSocketDisconnect, APIRouter
from typing import Dict, Set
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])

# ============================================================
# Connection Manager
# ============================================================

class ConnectionManager:
    def __init__(self):
        # room_name -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room: str):
        """Accept a new WebSocket connection and add it to a room."""
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = set()
        self.active_connections[room].add(websocket)
        logger.info(f"✅ Client connected to room '{room}'. Active: {len(self.active_connections[room])}")

    def disconnect(self, websocket: WebSocket, room: str):
        """Remove a WebSocket connection from a room."""
        if room in self.active_connections:
            self.active_connections[room].discard(websocket)
            if not self.active_connections[room]:
                del self.active_connections[room]
                logger.info(f"🗑️ Room '{room}' is now empty and removed.")
            else:
                logger.info(f"❌ Client disconnected from room '{room}'. Remaining: {len(self.active_connections[room])}")

    async def broadcast(self, room: str, message: dict, exclude: WebSocket = None):
        """Send a message to all clients in a room, except optionally the sender."""
        if room not in self.active_connections:
            return

        # Remove any dead connections
        dead_connections = set()
        for connection in self.active_connections[room]:
            try:
                if connection != exclude:
                    await connection.send_text(json.dumps(message))
            except Exception:
                dead_connections.add(connection)

        # Clean up dead connections
        for conn in dead_connections:
            self.active_connections[room].discard(conn)

        if not self.active_connections[room]:
            del self.active_connections[room]

    async def broadcast_to_all(self, room: str, message: dict):
        """Send a message to ALL clients in a room (including sender)."""
        await self.broadcast(room, message, exclude=None)


manager = ConnectionManager()


# ============================================================
# WebSocket Endpoint
# ============================================================

@router.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str):
    """
    WebSocket endpoint for real-time communication.
    Room is typically 'learner_{learnerId}'.
    """
    await manager.connect(websocket, room)

    try:
        while True:
            # Wait for messages from the client (Teacher Console)
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                logger.info(f"📨 Received from room '{room}': {message.get('type')}")

                # Broadcast the message to ALL other clients in the room
                # (e.g., the Reader Display)
                await manager.broadcast(room, message, exclude=websocket)

            except json.JSONDecodeError:
                logger.warning(f"⚠️ Received invalid JSON from room '{room}': {data}")

    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
        # Notify remaining clients that someone left
        await manager.broadcast_to_all(room, {
            "type": "system",
            "message": "A client has disconnected."
        })
    except Exception as e:
        logger.error(f"❌ WebSocket error in room '{room}': {e}")
        manager.disconnect(websocket, room)