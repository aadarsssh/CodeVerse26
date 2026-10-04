#!/usr/bin/env python3
"""
CodeVerse Hackathon 2026 - Backend REST API & Static Server
Pure Python 3 standard library implementation with SQLite3 database.
Zero external dependencies required.
"""

import os
import sys
import json
import sqlite3
import random
import string
import datetime
import mimetypes
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "codeverse.db")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")

os.makedirs(UPLOAD_DIR, exist_ok=True)

# -------------------------------------------------------------
# Database Setup
# -------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS teams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                registration_id VARCHAR(16) UNIQUE NOT NULL,
                team_name VARCHAR(100) UNIQUE NOT NULL,
                college_name VARCHAR(150) NOT NULL,
                track VARCHAR(50) NOT NULL,
                project_title VARCHAR(200),
                member_count INTEGER NOT NULL,
                expected_amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'PAYMENT_PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS team_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
                registration_id VARCHAR(16) NOT NULL,
                position INTEGER NOT NULL,
                is_leader BOOLEAN NOT NULL DEFAULT 0,
                full_name VARCHAR(100) NOT NULL,
                reg_no VARCHAR(50) NOT NULL,
                email VARCHAR(120) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
                registration_id VARCHAR(16) NOT NULL,
                payment_method VARCHAR(20) NOT NULL,
                transaction_id VARCHAR(100) UNIQUE NOT NULL,
                transaction_date DATE NOT NULL,
                amount_paid DECIMAL(10,2) NOT NULL,
                proof_path VARCHAR(255),
                status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                admin_remarks TEXT,
                verified_at TIMESTAMP,
                verified_by VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

# -------------------------------------------------------------
# Helpers
# -------------------------------------------------------------
def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "event_title": "CodeVerse Hackathon 2026",
        "min_members": 4,
        "max_members": 6,
        "fee_per_member": 150
    }

def generate_registration_id(conn):
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    cursor = conn.cursor()
    while True:
        rid = "CV26-" + "".join(random.choices(chars, k=6))
        cursor.execute("SELECT 1 FROM teams WHERE registration_id = ?", (rid,))
        if not cursor.fetchone():
            return rid

# -------------------------------------------------------------
# HTTP Request Handler
# -------------------------------------------------------------
class CodeVerseHandler(BaseHTTPRequestHandler):
    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, detail, status=400, errors=None):
        payload = {"detail": detail}
        if errors:
            payload["errors"] = errors
        self.send_json(payload, status=status)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API: Config
        if path == "/api/config":
            return self.send_json(load_config())

        # API: Admin List Teams
        if path == "/api/admin/registrations":
            return self.handle_admin_list_teams()

        # API: Get Single Team Registration
        if path.startswith("/api/registrations/"):
            rid = path.split("/")[3].strip().upper()
            return self.handle_get_team(rid)

        # Serve Uploaded Files
        if path.startswith("/uploads/"):
            filename = os.path.basename(path)
            filepath = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(filepath):
                return self.serve_file(filepath)
            else:
                self.send_error(404, "File not found")
                return

        # Serve Static Frontend Files
        self.serve_static(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API: Create Team Registration
        if path == "/api/registrations":
            return self.handle_create_team()

        # API: Submit Payment
        if path.startswith("/api/registrations/") and path.endswith("/payment"):
            parts = path.split("/")
            rid = parts[3].strip().upper()
            return self.handle_submit_payment(rid)

        self.send_error_json("Endpoint not found", 404)

    def do_PATCH(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API: Admin Update Status
        if path.startswith("/api/admin/registrations/") and path.endswith("/status"):
            parts = path.split("/")
            rid = parts[4].strip().upper()
            return self.handle_admin_update_status(rid)

        self.send_error_json("Endpoint not found", 404)

    # ---------------------------------------------------------
    # Route Handlers
    # ---------------------------------------------------------
    def handle_create_team(self):
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            return self.send_error_json("Empty request body", 400)

        raw_data = self.rfile.read(content_len)
        try:
            payload = json.loads(raw_data.decode("utf-8"))
        except Exception:
            return self.send_error_json("Malformed JSON payload", 400)

        cfg = load_config()
        members = payload.get("members", [])
        m_count = len(members)

        if m_count < cfg.get("min_members", 4) or m_count > cfg.get("max_members", 6):
            return self.send_error_json(
                f"A team must consist of between {cfg.get('min_members', 4)} and {cfg.get('max_members', 6)} members. Found: {m_count}.",
                422
            )

        team_name = (payload.get("team_name") or "").strip()
        college_name = (payload.get("college_name") or "").strip()
        track = (payload.get("track") or "General").strip()
        project_title = (payload.get("project_title") or "").strip()

        if not team_name:
            return self.send_error_json("Team name is required", 422)
        if not college_name:
            return self.send_error_json("College name is required", 422)

        # Duplicate checking across members
        emails = [m.get("email", "").strip().lower() for m in members]
        phones = [m.get("phone", "").strip() for m in members]
        reg_nos = [m.get("reg_no", "").strip().upper() for m in members]

        if len(set(emails)) != len(emails):
            return self.send_error_json("All members must have unique email addresses.", 422)
        if len(set(phones)) != len(phones):
            return self.send_error_json("All members must have unique phone numbers.", 422)
        if len(set(reg_nos)) != len(reg_nos):
            return self.send_error_json("All members must have unique college registration numbers.", 422)

        expected_amount = m_count * cfg.get("fee_per_member", 150)

        with get_db() as conn:
            cursor = conn.cursor()
            # Check team name uniqueness
            cursor.execute("SELECT 1 FROM teams WHERE LOWER(team_name) = LOWER(?)", (team_name,))
            if cursor.fetchone():
                return self.send_error_json("A team with this name is already registered. Please choose another name.", 409)

            rid = generate_registration_id(conn)
            cursor.execute("""
                INSERT INTO teams (registration_id, team_name, college_name, track, project_title, member_count, expected_amount, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'PAYMENT_PENDING')
            """, (rid, team_name, college_name, track, project_title, m_count, expected_amount))
            team_id = cursor.lastrowid

            for idx, m in enumerate(members):
                cursor.execute("""
                    INSERT INTO team_members (team_id, registration_id, position, is_leader, full_name, reg_no, email, phone)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    team_id,
                    rid,
                    idx + 1,
                    1 if idx == 0 else 0,
                    m.get("full_name", "").strip(),
                    m.get("reg_no", "").strip().upper(),
                    m.get("email", "").strip().lower(),
                    m.get("phone", "").strip()
                ))
            conn.commit()

        return self.send_json({
            "registration_id": rid,
            "team_name": team_name,
            "status": "PAYMENT_PENDING",
            "expected_amount": expected_amount,
            "member_count": m_count
        }, 201)

    def handle_get_team(self, rid):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM teams WHERE registration_id = ?", (rid,))
            team = cursor.fetchone()
            if not team:
                return self.send_error_json("Registration not found", 404)

            cursor.execute("SELECT * FROM team_members WHERE registration_id = ? ORDER BY position ASC", (rid,))
            members = [dict(m) for m in cursor.fetchall()]

            cursor.execute("SELECT * FROM payments WHERE registration_id = ? ORDER BY id DESC LIMIT 1", (rid,))
            payment = cursor.fetchone()

        result = dict(team)
        result["members"] = members
        result["payment"] = dict(payment) if payment else None
        return self.send_json(result)

    def handle_submit_payment(self, rid):
        content_type = self.headers.get("Content-Type", "")
        content_len = int(self.headers.get("Content-Length", 0))

        if not content_type.startswith("multipart/form-data"):
            return self.send_error_json("Request must be multipart/form-data", 400)

        boundary = content_type.split("boundary=")[-1].strip()
        body_bytes = self.rfile.read(content_len)

        # Parse multipart form data
        fields, files = self.parse_multipart(body_bytes, boundary)

        method = fields.get("method", "UPI").strip()
        txn_id = fields.get("txn_id", "").strip().upper()
        txn_date = fields.get("txn_date", datetime.date.today().isoformat()).strip()
        amount_paid = float(fields.get("amount_paid", 0))

        if not txn_id or len(txn_id) < 6:
            return self.send_error_json("A valid transaction ID / UTR number is required.", 422)

        proof_path = None
        if "proof" in files:
            file_info = files["proof"]
            orig_name = file_info["filename"]
            ext = os.path.splitext(orig_name)[-1].lower() or ".jpg"
            safe_name = f"proof_{rid}_{int(datetime.datetime.now().timestamp())}{ext}"
            saved_full_path = os.path.join(UPLOAD_DIR, safe_name)
            with open(saved_full_path, "wb") as f:
                f.write(file_info["data"])
            proof_path = f"/uploads/{safe_name}"

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, status FROM teams WHERE registration_id = ?", (rid,))
            team = cursor.fetchone()
            if not team:
                return self.send_error_json("Registration ID not found", 404)

            # Check UTR uniqueness across other registrations
            cursor.execute("SELECT registration_id FROM payments WHERE transaction_id = ? AND registration_id != ?", (txn_id, rid))
            duplicate = cursor.fetchone()
            if duplicate:
                return self.send_error_json("This transaction ID has already been recorded for another team.", 409)

            cursor.execute("""
                INSERT OR REPLACE INTO payments (team_id, registration_id, payment_method, transaction_id, transaction_date, amount_paid, proof_path, status, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
            """, (team["id"], rid, method, txn_id, txn_date, amount_paid, proof_path))

            cursor.execute("""
                UPDATE teams SET status = 'VERIFICATION_PENDING', updated_at = CURRENT_TIMESTAMP WHERE registration_id = ?
            """, (rid,))
            conn.commit()

        return self.send_json({
            "registration_id": rid,
            "status": "VERIFICATION_PENDING",
            "transaction_id": txn_id,
            "amount_paid": amount_paid,
            "proof_url": proof_path
        }, 201)

    def handle_admin_list_teams(self):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM teams ORDER BY id DESC")
            teams = [dict(t) for t in cursor.fetchall()]

            for t in teams:
                rid = t["registration_id"]
                cursor.execute("SELECT * FROM team_members WHERE registration_id = ? ORDER BY position ASC", (rid,))
                t["members"] = [dict(m) for m in cursor.fetchall()]

                cursor.execute("SELECT * FROM payments WHERE registration_id = ? ORDER BY id DESC LIMIT 1", (rid,))
                p = cursor.fetchone()
                if p:
                    t["payment"] = dict(p)
                    t["payment"]["proof_url"] = p["proof_path"]
                else:
                    t["payment"] = None

        return self.send_json(teams)

    def handle_admin_update_status(self, rid):
        content_len = int(self.headers.get("Content-Length", 0))
        raw_data = self.rfile.read(content_len)
        try:
            payload = json.loads(raw_data.decode("utf-8"))
        except Exception:
            return self.send_error_json("Malformed JSON payload", 400)

        new_status = payload.get("status")  # 'VERIFIED' or 'REJECTED'
        remarks = payload.get("remarks", "")

        team_status = "CONFIRMED" if new_status == "VERIFIED" else "PAYMENT_REJECTED" if new_status == "REJECTED" else new_status

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM teams WHERE registration_id = ?", (rid,))
            team = cursor.fetchone()
            if not team:
                return self.send_error_json("Team not found", 404)

            cursor.execute("""
                UPDATE teams SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE registration_id = ?
            """, (team_status, rid))

            cursor.execute("""
                UPDATE payments SET status = ?, admin_remarks = ?, verified_at = CURRENT_TIMESTAMP WHERE registration_id = ?
            """, (new_status, remarks, rid))
            conn.commit()

        return self.send_json({"registration_id": rid, "status": team_status, "payment_status": new_status})

    # ---------------------------------------------------------
    # Static & Multipart Helpers
    # ---------------------------------------------------------
    def parse_multipart(self, body_bytes, boundary):
        fields = {}
        files = {}
        delim = ("--" + boundary).encode("utf-8")
        parts = body_bytes.split(delim)

        for part in parts:
            if not part or part == b"--\r\n" or part == b"--":
                continue
            if b"\r\n\r\n" not in part:
                continue
            headers_raw, content = part.split(b"\r\n\r\n", 1)
            # Remove trailing \r\n
            if content.endswith(b"\r\n"):
                content = content[:-2]

            headers_text = headers_raw.decode("utf-8", errors="ignore")
            if 'name="' in headers_text:
                field_name = headers_text.split('name="')[1].split('"')[0]
                if 'filename="' in headers_text:
                    filename = headers_text.split('filename="')[1].split('"')[0]
                    if filename:
                        files[field_name] = {"filename": filename, "data": content}
                else:
                    fields[field_name] = content.decode("utf-8", errors="ignore")

        return fields, files

    def serve_file(self, filepath):
        content_type, _ = mimetypes.guess_type(filepath)
        content_type = content_type or "application/octet-stream"
        with open(filepath, "rb") as f:
            content = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def serve_static(self, path):
        if path == "/" or not path:
            path = "/index.html"
        safe_rel_path = path.lstrip("/")
        full_path = os.path.join(BASE_DIR, safe_rel_path)

        if not os.path.exists(full_path) or os.path.isdir(full_path):
            full_path = os.path.join(BASE_DIR, "index.html")

        if os.path.exists(full_path):
            self.serve_file(full_path)
        else:
            self.send_error(404, "File not found")

# -------------------------------------------------------------
# Main Entry Point
# -------------------------------------------------------------
def run(port=8000, host="127.0.0.1"):
    init_db()
    server_address = (host, port)
    httpd = HTTPServer(server_address, CodeVerseHandler)
    print(f"🚀 CodeVerse Hackathon 2026 server running at http://{host}:{port}/")
    print(f"👉 Student Registration: http://{host}:{port}/")
    print(f"🛡️ Admin Dashboard:    http://{host}:{port}/admin.html")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()

if __name__ == "__main__":
    port = 8000
    host = "127.0.0.1"
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    if len(sys.argv) > 2:
        host = sys.argv[2]
    run(port, host)
