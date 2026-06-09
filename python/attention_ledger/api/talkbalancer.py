"""TalkBalancer API — 手動アラート MVP (ロードマップ Step 1).

要件定義書: docs/talkbalancer/REQUIREMENTS_v0.2.md

セッションとアラートはメモリ内にのみ保持する。録音・文字起こし・永続化は
行わず、セッション終了（DELETE）で全データを破棄する（非機能要件 10.1）。
1サーバー = 1テーブル（1セッション）の前提。
"""

import threading
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/talkbalancer", tags=["talkbalancer"])

# ── 型定義（要件 12. データモデル準拠。幹事リモコン F-05 の9ボタンに対応） ──

SessionMode = Literal["volume_only", "balance", "transcript"]

AlertType = Literal[
    "talk_too_much",     # 話しすぎ
    "too_loud",          # うるさすぎ
    "same_story",        # 同じ話
    "preaching",         # 説教っぽい
    "sensitive_topic",   # センシティブ話題
    "pass_around",       # 他の人にも振る
    "topic_shift",       # 話題転換
    "drink_water",       # 水を飲む
    "take_break",        # 休憩
]

# F-06: 命令・断定・個人攻撃を避けた丁重な文言
_ALERT_MESSAGES: dict = {
    "talk_too_much": "お話タイムが少し長めです。\nそろそろ別の人にも振ると、さらに良い場になりそうです。",
    "too_loud": "店内音量が高めです。\n全体会話より、近い人同士の会話が向いていそうです。",
    "same_story": "この話題は一度出ています。\n少し別の話題に移ると、会話が広がりそうです。",
    "preaching": "少し一方向の会話が続いています。\nここで一度、相手の話も聞いてみましょう。",
    "sensitive_topic": "この話題は少しセンシティブです。\n個人事情には踏み込みすぎない方がよさそうです。",
    "pass_around": "まだ話せていない人がいるかもしれません。\n近くの人に話を振ってみましょう。",
    "topic_shift": "ここで少し話題を変えてみるのはどうでしょう。\n新しい話で会話が広がりそうです。",
    "drink_water": "ここで一杯、お水を挟みましょう。\n明日の自分がきっと助かります。",
    "take_break": "少し休憩を挟みましょう。\n席を立つと、会話もリフレッシュされます。",
}

_ALERT_SEVERITY: dict = {
    "preaching": "notice",
    "sensitive_topic": "notice",
}


class SessionCreate(BaseModel):
    title: str = Field(default="飲み会", max_length=100)
    mode: SessionMode = "volume_only"


class Session(BaseModel):
    id: str
    title: str
    startedAt: str
    mode: SessionMode
    savePolicy: Literal["none"] = "none"  # MVP は保存なし固定


class AlertCreate(BaseModel):
    type: AlertType
    source: Literal["manual", "auto"] = "manual"


class AlertEvent(BaseModel):
    seq: int
    sessionId: str
    timestamp: str
    type: AlertType
    source: Literal["manual", "auto"]
    message: str
    severity: Literal["info", "notice", "strong"]


# ── メモリ内状態（録音・永続化なし） ──

_MAX_ALERTS = 50

_lock = threading.Lock()
_session: Optional[Session] = None
_alerts: deque = deque(maxlen=_MAX_ALERTS)
_seq = 0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── エンドポイント ──

@router.get("/session")
def get_session():
    """現在のセッション状態。テーブル表示/リモコンの起動時確認に使う。"""
    with _lock:
        if _session is None:
            return {"active": False, "session": None, "seq": _seq}
        return {"active": True, "session": _session, "seq": _seq}


@router.post("/session", status_code=201)
def start_session(body: SessionCreate):
    """セッション開始（F-02 同意確認後に呼ぶ）。既存セッションは置き換える。"""
    global _session, _seq
    with _lock:
        _session = Session(
            id=uuid.uuid4().hex[:12],
            title=body.title,
            startedAt=_now_iso(),
            mode=body.mode,
        )
        _alerts.clear()
        _seq = 0
        return {"active": True, "session": _session, "seq": _seq}


@router.delete("/session")
def end_session():
    """セッション終了。全データを破棄する（10.1 終了時にデータ削除）。"""
    global _session, _seq
    with _lock:
        _session = None
        _alerts.clear()
        _seq = 0
        return {"active": False, "deleted": True}


@router.post("/alerts", status_code=201)
def post_alert(body: AlertCreate):
    """幹事リモコン（F-05）からの丁重アラート発行。"""
    global _seq
    with _lock:
        if _session is None:
            raise HTTPException(status_code=409, detail="セッションが開始されていません")
        _seq += 1
        alert = AlertEvent(
            seq=_seq,
            sessionId=_session.id,
            timestamp=_now_iso(),
            type=body.type,
            source=body.source,
            message=_ALERT_MESSAGES[body.type],
            severity=_ALERT_SEVERITY.get(body.type, "info"),
        )
        _alerts.append(alert)
        return alert


@router.get("/alerts")
def list_alerts(after: int = 0):
    """`after` より新しいアラートを返す。テーブル表示（F-06）がポーリングする。"""
    with _lock:
        items: List[AlertEvent] = [a for a in _alerts if a.seq > after]
        return {"alerts": items, "seq": _seq, "active": _session is not None}
