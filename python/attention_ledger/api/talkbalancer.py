"""TalkBalancer API — 手動アラート MVP (ロードマップ Step 1).

要件定義書: docs/talkbalancer/REQUIREMENTS_v0.2.md

セッションとアラートはメモリ内にのみ保持する。録音・文字起こし・永続化は
行わず、セッション終了（DELETE）で全データを破棄する（非機能要件 10.1）。
1サーバー = 1テーブル（1セッション）の前提。
"""

import math
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, ValidationError

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
        _reset_metrics_locked()
        return {"active": True, "session": _session, "seq": _seq}


@router.delete("/session")
def end_session():
    """セッション終了。全データを破棄する（10.1 終了時にデータ削除）。"""
    global _session, _seq
    with _lock:
        _session = None
        _alerts.clear()
        _seq = 0
        _reset_metrics_locked()
        return {"active": False, "deleted": True}


def _create_alert_locked(alert_type: str, source: str) -> AlertEvent:
    """_lock 保持中に呼ぶこと。"""
    global _seq
    _seq += 1
    alert = AlertEvent(
        seq=_seq,
        sessionId=_session.id,
        timestamp=_now_iso(),
        type=alert_type,
        source=source,
        message=_ALERT_MESSAGES[alert_type],
        severity=_ALERT_SEVERITY.get(alert_type, "info"),
    )
    _alerts.append(alert)
    return alert


@router.post("/alerts", status_code=201)
def post_alert(body: AlertCreate):
    """幹事リモコン（F-05）からの丁重アラート発行。"""
    with _lock:
        if _session is None:
            raise HTTPException(status_code=409, detail="セッションが開始されていません")
        return _create_alert_locked(body.type, body.source)


@router.get("/alerts")
def list_alerts(after: int = 0):
    """`after` より新しいアラートを返す。テーブル表示（F-06）がポーリングする。"""
    with _lock:
        items: List[AlertEvent] = [a for a in _alerts if a.seq > after]
        return {"alerts": items, "seq": _seq, "active": _session is not None}


@router.get("/report")
def get_report():
    """終了前に確認する一時レポート（録音・文字起こし・永続保存なし）。

    セッション終了 API は全データを破棄するため、このレポートも開催中の
    メモリ状態から都度生成する。
    """
    with _lock:
        if _session is None:
            return {"active": False, "session": None}

        now = time.time()
        started = datetime.fromisoformat(_session.startedAt)
        duration = max(0, int(now - started.timestamp()))
        counts = {t: 0 for t in _ALERT_MESSAGES}
        manual = 0
        auto = 0
        for alert in _alerts:
            counts[alert.type] = counts.get(alert.type, 0) + 1
            if alert.source == "auto":
                auto += 1
            else:
                manual += 1

        return {
            "active": True,
            "session": _session,
            "durationSec": duration,
            "totalAlerts": len(_alerts),
            "manualAlerts": manual,
            "autoAlerts": auto,
            "alertCounts": counts,
            "latestAlerts": list(_alerts)[-5:],
            "analysis": _compute_analysis_locked(now),
            "privacy": {
                "recording": False,
                "transcription": False,
                "cloudUpload": False,
                "savePolicy": "none",
            },
        }


# ════════════════════════════════════════════════════════
# F-07 音量・騒音解析 ＋ Step 3 Local Server 連携（WebSocket）
# ＋ Step 4 騒音・会話密度メーター
#
# テーブル端末が約1秒ごとに音量メトリクス（RMS/ピーク）を送り、
# サーバーが騒音レベル・会話密度・会話しやすさスコアを返す。
# 音声波形そのものは送らない（10.1 プライバシー）。
# ════════════════════════════════════════════════════════

_METRICS_WINDOW_SEC = 300          # 5分の移動ウィンドウ
_RECENT_SEC = 5                    # 「現在の音量」は直近5秒平均
_AUTO_ALERT_SUSTAIN_SEC = 30       # 騒音が続いたら自動アラート（F-06 too_loud）
_AUTO_ALERT_COOLDOWN_SEC = 300     # 自動アラートは5分に1回まで

_metrics: deque = deque()          # (epoch_sec, rms, peak)
_loud_since: Optional[float] = None
_last_auto_alert: float = 0.0


class MetricIn(BaseModel):
    rms: float = Field(ge=0.0, le=1.0)
    peak: float = Field(default=0.0, ge=0.0, le=1.0)


def _reset_metrics_locked() -> None:
    global _loud_since, _last_auto_alert
    _metrics.clear()
    _loud_since = None
    _last_auto_alert = 0.0


def _percentile(sorted_vals: List[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = min(len(sorted_vals) - 1, int(len(sorted_vals) * p))
    return sorted_vals[idx]


def _noise_category(level: float) -> str:
    if level < 0.02:
        return "quiet"
    if level < 0.08:
        return "normal"
    if level < 0.16:
        return "loud"
    return "very_loud"


def _compute_analysis_locked(now: float) -> dict:
    while _metrics and _metrics[0][0] < now - _METRICS_WINDOW_SEC:
        _metrics.popleft()

    samples = list(_metrics)
    if not samples:
        return {
            "active": _session is not None, "samples": 0,
            "noiseLevel": 0.0, "noiseDb": -100.0, "noiseCategory": "quiet",
            "noiseFloor": 0.0, "speechDensity1m": 0.0, "speechDensity5m": 0.0,
            "comfortScore": 100,
        }

    rms_sorted = sorted(r for _, r, _ in samples)
    noise_floor = _percentile(rms_sorted, 0.10)
    speech_threshold = max(noise_floor * 1.8, 0.01)

    recent = [r for t, r, _ in samples if t >= now - _RECENT_SEC]
    level = sum(recent) / len(recent) if recent else 0.0

    def density(window: float) -> float:
        frames = [(t, r) for t, r, _ in samples if t >= now - window]
        if not frames:
            return 0.0
        return sum(1 for _, r in frames if r > speech_threshold) / len(frames)

    category = _noise_category(level)
    noise_penalty = {"quiet": 0, "normal": 5, "loud": 35, "very_loud": 55}[category]
    d1 = density(60)
    # 沈黙が続いている場合も少しだけ下げる（盛り上げ余地の表示）
    silence_penalty = 10 if (len(samples) > 60 and d1 < 0.05) else 0
    comfort = max(0, min(100, 100 - noise_penalty - silence_penalty))

    return {
        "active": _session is not None,
        "samples": len(samples),
        "noiseLevel": round(level, 4),
        "noiseDb": round(20 * math.log10(max(level, 1e-5)), 1),
        "noiseCategory": category,
        "noiseFloor": round(noise_floor, 4),
        "speechDensity1m": round(d1, 3),
        "speechDensity5m": round(density(300), 3),
        "comfortScore": comfort,
    }


def _ingest_metric_locked(m: MetricIn, now: float) -> dict:
    """メトリクスを取り込み、必要なら自動 too_loud アラートを発行して解析結果を返す。"""
    global _loud_since, _last_auto_alert
    _metrics.append((now, m.rms, m.peak))
    analysis = _compute_analysis_locked(now)

    if _session is not None and analysis["noiseCategory"] in ("loud", "very_loud"):
        if _loud_since is None:
            _loud_since = now
        elif (now - _loud_since >= _AUTO_ALERT_SUSTAIN_SEC
              and now - _last_auto_alert >= _AUTO_ALERT_COOLDOWN_SEC):
            _create_alert_locked("too_loud", "auto")
            _last_auto_alert = now
    else:
        _loud_since = None

    analysis["seq"] = _seq
    return analysis


@router.get("/analysis")
def get_analysis():
    """現在の騒音・会話密度・会話しやすさスコア（F-04 表示用）。"""
    with _lock:
        result = _compute_analysis_locked(time.time())
        result["seq"] = _seq
        return result


@router.post("/metrics")
def post_metric(body: MetricIn):
    """REST フォールバック（WebSocket が使えない環境向け）。"""
    with _lock:
        if _session is None:
            raise HTTPException(status_code=409, detail="セッションが開始されていません")
        return _ingest_metric_locked(body, time.time())


@router.websocket("/ws/metrics")
async def ws_metrics(ws: WebSocket):
    """Step 3: テーブル端末 → Local Server の音声メトリクス送信路。

    受信: {"rms": 0..1, "peak": 0..1}（約1秒ごと）
    送信: 解析結果（GET /analysis と同形式）を受信のたびに返す。
    """
    await ws.accept()
    with _lock:
        if _session is None:
            await ws.send_json({"error": "セッションが開始されていません"})
            await ws.close(code=4000)
            return
    try:
        while True:
            raw = await ws.receive_json()
            try:
                metric = MetricIn.model_validate(raw)
            except ValidationError:
                await ws.send_json({"error": "invalid metric"})
                continue
            with _lock:
                if _session is None:
                    await ws.send_json({"error": "session ended"})
                    await ws.close(code=4001)
                    return
                analysis = _ingest_metric_locked(metric, time.time())
            await ws.send_json(analysis)
    except WebSocketDisconnect:
        pass
