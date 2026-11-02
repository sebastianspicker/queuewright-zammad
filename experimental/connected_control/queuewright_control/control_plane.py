"""ControlPlane composition root."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any

from .control_connection import ControlConnectionMixin
from .control_evidence import ControlEvidenceMixin
from .control_recovery import ControlRecoveryMixin
from .control_workflow import ControlWorkflowMixin
from .ledger import Ledger
from .models import AdapterPolicy, Connection, EphemeralCredential, Preview


class ControlPlane(
    ControlConnectionMixin,
    ControlWorkflowMixin,
    ControlRecoveryMixin,
    ControlEvidenceMixin,
):
    def __init__(
        self,
        ledger: Ledger,
        policy: AdapterPolicy,
        transport: Callable[..., Any],
        resolver: Callable[[str], Sequence[str]] | None = None,
    ) -> None:
        self.ledger = ledger
        self.policy = policy
        self.transport = transport
        self.resolver = resolver
        self.connection: Connection | None = None
        self._credential: EphemeralCredential | None = None
        self.preview: Preview | None = None
        self._approved_hash: str | None = None
        self.session_state = "disconnected"
