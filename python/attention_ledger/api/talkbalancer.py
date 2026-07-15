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

# 実装済みの解析モード。balance は手動話者記録、transcript は保存しない
# セッション内メモとして提供する。
IMPLEMENTED_MODES: frozenset = frozenset({"volume_only", "balance", "transcript"})

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
    participantCount: int = Field(default=4, ge=1, le=20)
    participantNames: List[str] = Field(default_factory=list, max_length=20)
    # F-01 開始前宣言に全員が合意した時刻(ISO8601, クライアント申告)。未指定可
    agreedAt: Optional[str] = Field(default=None, max_length=40)


class Session(BaseModel):
    id: str
    title: str
    startedAt: str
    mode: SessionMode
    savePolicy: Literal["none"] = "none"  # MVP は保存なし固定
    agreedAt: Optional[str] = None


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


class Participant(BaseModel):
    id: str
    name: str
    color: str


class ParticipantsUpdate(BaseModel):
    names: List[str] = Field(min_length=1, max_length=20)


class SpeakerEventCreate(BaseModel):
    participantId: str
    durationSec: int = Field(default=15, ge=1, le=300)
    source: Literal["manual", "auto"] = "manual"


class SpeakerEventBatch(BaseModel):
    events: List[SpeakerEventCreate] = Field(min_length=1, max_length=100)


class SpeakerEvent(BaseModel):
    id: str
    sessionId: str
    participantId: str
    timestamp: str
    durationSec: int
    source: Literal["manual", "auto"]


class TranscriptNoteCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    participantId: Optional[str] = None
    source: Literal["manual", "auto"] = "manual"


class TranscriptNote(BaseModel):
    id: str
    sessionId: str
    timestamp: str
    text: str
    participantId: Optional[str] = None
    participantName: Optional[str] = None
    source: Literal["manual", "auto"]


# ── メモリ内状態（録音・永続化なし） ──

_MAX_ALERTS = 50
_MAX_SPEAKER_EVENTS = 5000
_PARTICIPANT_COLORS = [
    "#00f2ff", "#00ff88", "#ffaa00", "#ff4466", "#7000ff",
    "#38bdf8", "#f472b6", "#a3e635", "#fb7185", "#c084fc",
]

_lock = threading.Lock()
_session: Optional[Session] = None
_alerts: deque = deque(maxlen=_MAX_ALERTS)
_participants: List[Participant] = []
_speaker_events: deque = deque(maxlen=_MAX_SPEAKER_EVENTS)
_transcript_notes: deque = deque(maxlen=200)
_seq = 0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _participant_name(i: int) -> str:
    return f"{chr(65 + i)}さん" if i < 26 else f"参加者{i + 1}"


def _make_participants(names: List[str], count: int) -> List[Participant]:
    clean = [n.strip() for n in names if n.strip()]
    if not clean:
        clean = [_participant_name(i) for i in range(count)]
    clean = clean[:20]
    return [
        Participant(
            id=f"speaker_{i + 1}",
            name=name[:30],
            color=_PARTICIPANT_COLORS[i % len(_PARTICIPANT_COLORS)],
        )
        for i, name in enumerate(clean)
    ]


def _participant_exists(participant_id: str) -> bool:
    return any(p.id == participant_id for p in _participants)


def _participant_name_by_id(participant_id: Optional[str]) -> Optional[str]:
    if participant_id is None:
        return None
    for participant in _participants:
        if participant.id == participant_id:
            return participant.name
    return None


def _speaker_stats_locked(now: float) -> dict:
    totals = {p.id: 0 for p in _participants}
    recent = {p.id: 0 for p in _participants}
    latest: Optional[SpeakerEvent] = None

    for event in _speaker_events:
        if event.sessionId != _session.id:
            continue
        if event.participantId not in totals:
            continue
        totals[event.participantId] += event.durationSec
        event_ts = datetime.fromisoformat(event.timestamp).timestamp()
        if event_ts >= now - 300:
            recent[event.participantId] += event.durationSec
        if latest is None or event.timestamp > latest.timestamp:
            latest = event

    total_sum = sum(totals.values())
    recent_sum = sum(recent.values())

    def rows(bucket: dict, denom: int) -> List[dict]:
        return [
            {
                "participantId": p.id,
                "name": p.name,
                "color": p.color,
                "seconds": bucket.get(p.id, 0),
                "share": round(bucket.get(p.id, 0) / denom, 4) if denom else 0.0,
            }
            for p in _participants
        ]

    return {
        "active": _session is not None,
        "participants": _participants,
        "total": rows(totals, total_sum),
        "recent5m": rows(recent, recent_sum),
        "totalSeconds": total_sum,
        "recent5mSeconds": recent_sum,
        "latestEvent": latest,
    }


# ── エンドポイント ──

@router.get("/session")
def get_session():
    """現在のセッション状態。テーブル表示/リモコンの起動時確認に使う。"""
    with _lock:
        if _session is None:
            return {"active": False, "session": None, "seq": _seq, "participants": []}
        return {
            "active": True,
            "session": _session,
            "seq": _seq,
            "participants": _participants,
        }


def _privacy_for_mode(mode: SessionMode) -> dict:
    """解析モードからプライバシー状態を導出する（10.1 常時表示用）。

    フロント derivePrivacy（src/lib/talkbalancer.ts）と同一マッピングにすること：
    transcript のみ文字起こしメモが True。音声の録音保存とクラウド送信は
    どのモードでも行わない。
    """
    is_transcript = mode == "transcript"
    return {
        "recording": False,
        "transcription": is_transcript,
        "cloudUpload": False,
        "savePolicy": "none",
    }


@router.post("/session", status_code=201)
def start_session(body: SessionCreate):
    """セッション開始（F-02 同意確認後に呼ぶ）。既存セッションは置き換える。"""
    global _session, _seq, _participants
    if body.mode not in IMPLEMENTED_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"解析モード '{body.mode}' は未実装です",
        )
    with _lock:
        _session = Session(
            id=uuid.uuid4().hex[:12],
            title=body.title,
            startedAt=_now_iso(),
            mode=body.mode,
            agreedAt=body.agreedAt,
        )
        _participants = _make_participants(body.participantNames, body.participantCount)
        _alerts.clear()
        _speaker_events.clear()
        _transcript_notes.clear()
        _seq = 0
        _reset_metrics_locked()
        return {"active": True, "session": _session, "seq": _seq, "participants": _participants}


@router.delete("/session")
def end_session():
    """セッション終了。全データを破棄する（10.1 終了時にデータ削除）。"""
    global _session, _seq, _participants
    with _lock:
        _session = None
        _participants = []
        _alerts.clear()
        _speaker_events.clear()
        _transcript_notes.clear()
        _seq = 0
        _reset_metrics_locked()
        return {"active": False, "deleted": True}


@router.get("/participants")
def get_participants():
    """テーブル人数と話者ラベル。MVPでは手動記録、将来は話者分離のクラスタに接続する。"""
    with _lock:
        return {"active": _session is not None, "participants": _participants}


@router.put("/participants")
def put_participants(body: ParticipantsUpdate):
    """参加者名を更新する。話者イベントはラベル変更に追従する。"""
    global _participants
    with _lock:
        if _session is None:
            raise HTTPException(status_code=409, detail="セッションが開始されていません")
        _participants = _make_participants(body.names, len(body.names))
        return {"active": True, "participants": _participants}


def _record_speaker_event_locked(body: SpeakerEventCreate) -> SpeakerEvent:
    if _session is None:
        raise HTTPException(status_code=409, detail="セッションが開始されていません")
    if not _participant_exists(body.participantId):
        raise HTTPException(status_code=404, detail="参加者が見つかりません")
    event = SpeakerEvent(
        id=uuid.uuid4().hex[:12],
        sessionId=_session.id,
        participantId=body.participantId,
        timestamp=_now_iso(),
        durationSec=body.durationSec,
        source=body.source,
    )
    _speaker_events.append(event)
    return event


@router.post("/speaker-events", status_code=201)
def post_speaker_event(body: SpeakerEventCreate):
    """話者の発話時間を手動記録する。将来の話者分離は同じイベント形式で投入する。"""
    with _lock:
        event = _record_speaker_event_locked(body)
        return {"event": event, "stats": _speaker_stats_locked(time.time())}


@router.post("/speaker-events/batch", status_code=201)
def post_speaker_event_batch(body: SpeakerEventBatch):
    """5分ごとのまとめ投入や将来の話者分離バッチ投入に使う。"""
    with _lock:
        events = [_record_speaker_event_locked(item) for item in body.events]
        return {"events": events, "stats": _speaker_stats_locked(time.time())}


@router.get("/speaker-stats")
def get_speaker_stats():
    """話者別の全体/直近5分の発話比率。円グラフ表示用。"""
    with _lock:
        if _session is None:
            return {
                "active": False, "participants": [], "total": [], "recent5m": [],
                "totalSeconds": 0, "recent5mSeconds": 0, "latestEvent": None,
            }
        return _speaker_stats_locked(time.time())


@router.get("/transcript-notes")
def get_transcript_notes():
    """モードC用の文字起こし/要点メモ。録音保存はせず、メモリ内のみ保持する。"""
    with _lock:
        if _session is None:
            return {"active": False, "enabled": False, "notes": []}
        return {
            "active": True,
            "enabled": _session.mode == "transcript",
            "notes": list(_transcript_notes),
        }


@router.post("/transcript-notes", status_code=201)
def post_transcript_note(body: TranscriptNoteCreate):
    """モードCでのみ、幹事が文字起こしメモを追加できる。"""
    with _lock:
        if _session is None:
            raise HTTPException(status_code=409, detail="セッションが開始されていません")
        if _session.mode != "transcript":
            raise HTTPException(status_code=409, detail="文字起こしメモはモードCでのみ使えます")
        if body.participantId is not None and not _participant_exists(body.participantId):
            raise HTTPException(status_code=404, detail="参加者が見つかりません")
        text = body.text.strip()
        if not text:
            raise HTTPException(status_code=422, detail="メモ本文が空です")
        note = TranscriptNote(
            id=uuid.uuid4().hex[:12],
            sessionId=_session.id,
            timestamp=_now_iso(),
            text=text,
            participantId=body.participantId,
            participantName=_participant_name_by_id(body.participantId),
            source=body.source,
        )
        _transcript_notes.append(note)
        return {"note": note, "notes": list(_transcript_notes)}


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
            "speakerStats": _speaker_stats_locked(now),
            "transcriptNotes": list(_transcript_notes)[-20:],
            "privacy": _privacy_for_mode(_session.mode),
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
