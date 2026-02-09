#!/usr/bin/env python3
"""
Python Client Example - Agent Memory System with Authentication

This example demonstrates how to use the Agent Memory System API
with the new authentication features using Python.
"""

import requests
import json
import time
from typing import Optional, Dict, Any, List


class AgentMemoryClient:
    """Client for Agent Memory System API with authentication."""

    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expires_at: float = 0

    def login(self, username: str, password: str, tenant_id: str = "default") -> None:
        """
        Login and obtain authentication tokens.

        Args:
            username: User's username
            password: User's password
            tenant_id: Tenant/organization ID (default: "default")
        """
        response = requests.post(
            f"{self.base_url}/auth/login",
            json={
                "username": username,
                "password": password,
                "tenant_id": tenant_id,
            }
        )

        if response.status_code != 200:
            raise Exception(f"Login failed: {response.text}")

        data = response.json()
        self.access_token = data["access_token"]
        self.refresh_token = data["refresh_token"]
        self.token_expires_at = time.time() + data["expires_in"]

        print(f"✅ Logged in as {data['user']['username']}")
        print(f"   Access token expires in {data['expires_in']}s")
        print(f"   Refresh token expires in {data['refresh_expires_in']}s")

    def refresh_access_token(self) -> None:
        """
        Refresh access token using refresh token.

        Raises:
            Exception: If no refresh token is available or refresh fails
        """
        if not self.refresh_token:
            raise Exception("No refresh token available")

        response = requests.post(
            f"{self.base_url}/auth/token/refresh",
            json={"refresh_token": self.refresh_token}
        )

        if response.status_code != 200:
            raise Exception(f"Token refresh failed: {response.text}")

        data = response.json()
        self.access_token = data["access_token"]
        self.refresh_token = data["refresh_token"]  # New refresh token (rotation)
        self.token_expires_at = time.time() + data["expires_in"]

        print("✅ Access token refreshed")
        print("   New refresh token issued (old token revoked)")

    def _ensure_authenticated(self) -> None:
        """Ensure we have a valid access token."""
        if not self.access_token or time.time() >= self.token_expires_at:
            self.refresh_access_token()

    def _get_headers(self) -> Dict[str, str]:
        """Get authorization headers with bearer token."""
        self._ensure_authenticated()
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.access_token}"
        }

    def record_event(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Record an event to memory.

        Args:
            params: Event parameters including session_id, channel, actor, kind, content

        Returns:
            Response data with event_id and chunk_ids
        """
        response = requests.post(
            f"{self.base_url}/api/v1/events",
            headers=self._get_headers(),
            json={
                **params,
                "sensitivity": "none",
                "tags": []
            }
        )

        if response.status_code != 201:
            raise Exception(f"Event recording failed: {response.text}")

        return response.json()

    def build_acb(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build an Active Context Bundle.

        Args:
            params: ACB parameters including session_id, agent_id, channel, intent

        Returns:
            ACB data with sections and token usage
        """
        response = requests.post(
            f"{self.base_url}/api/v1/acb/build",
            headers=self._get_headers(),
            json=params
        )

        if response.status_code != 200:
            raise Exception(f"ACB build failed: {response.text}")

        return response.json()

    def list_sessions(self) -> List[Dict[str, Any]]:
        """
        List active sessions for the authenticated user.

        Returns:
            List of session objects
        """
        response = requests.get(
            f"{self.base_url}/auth/sessions",
            headers=self._get_headers()
        )

        if response.status_code != 200:
            raise Exception(f"Failed to list sessions: {response.text}")

        return response.json()["sessions"]

    def logout(self) -> None:
        """
        Logout and revoke refresh token.
        """
        if not self.refresh_token:
            return

        response = requests.post(
            f"{self.base_url}/auth/token/revoke",
            headers=self._get_headers(),
            json={"refresh_token": self.refresh_token}
        )

        if response.status_code == 200:
            print("✅ Logged out successfully")

        self.access_token = None
        self.refresh_token = None


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

def main():
    """Run the example client."""
    client = AgentMemoryClient()

    try:
        print("=== Agent Memory System - Python Authentication Example ===\n")

        # 1. Login
        print("1. Logging in...")
        client.login("testuser", "password123", "my-tenant")

        # 2. Record an event
        print("\n2. Recording an event...")
        event_result = client.record_event({
            "session_id": "session-123",
            "channel": "private",
            "actor": {"type": "human", "id": "user-456"},
            "kind": "message",
            "content": {"text": "Hello from Python client!"}
        })
        print(f"   Event recorded: {event_result['event_id']}")

        # 3. Build Active Context Bundle
        print("\n3. Building Active Context Bundle...")
        acb = client.build_acb({
            "session_id": "session-123",
            "agent_id": "agent-789",
            "channel": "private",
            "intent": "Respond to user greeting",
            "query_text": "user greeting"
        })
        print(f"   ACB built: {acb['token_used_est']}/{acb['budget_tokens']} tokens")
        print(f"   Sections: {', '.join(s['name'] for s in acb['sections'])}")

        # 4. List sessions
        print("\n4. Listing active sessions...")
        sessions = client.list_sessions()
        print(f"   Active sessions: {len(sessions)}")
        for session in sessions:
            status = "active" if session["is_active"] else "inactive"
            print(f"   - {session['session_id']} ({status})")

        # 5. Logout
        print("\n5. Logging out...")
        client.logout()

        print("\n=== Python example completed successfully! ===")

    except Exception as error:
        print(f"\n❌ Error: {error}")
        exit(1)


if __name__ == "__main__":
    main()
