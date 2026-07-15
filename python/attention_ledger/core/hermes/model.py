from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HermesRunConfig(BaseModel):
    url: str
    task: str = Field(..., min_length=1, max_length=1000)
    product_area: str = Field("hermes", max_length=64)
    profile_name: str = Field("default", max_length=64)
    allow_hosts: List[str] = Field(default_factory=list)
    redact_selectors: List[str] = Field(default_factory=list)
    max_steps: int = Field(1, ge=1, le=20)
    save_screenshots: bool = True
    capture_network: bool = True
    capture_web_vitals: bool = True


class HermesStepRecord(BaseModel):
    step_index: int
    url: str
    title: str
    action: str
    duration_ms: int
    screenshot_path: Optional[str] = None
    summary_json: Dict[str, Any] = Field(default_factory=dict)


class HermesNetworkRecord(BaseModel):
    method: str
    url: str
    host: str
    path: str
    resource_type: str
    status: Optional[int] = None
    duration_ms: Optional[int] = None
    body_saved: bool = False
    headers_saved: bool = False


class HermesFinding(BaseModel):
    type: str
    severity: str
    message: str
    evidence_json: Dict[str, Any] = Field(default_factory=dict)


class HermesRunResult(BaseModel):
    id: Optional[int] = None
    run_key: str
    started_at: str
    completed_at: str
    status: str
    url: str
    sanitized_url: str
    task: str
    product_area: str
    profile_name: str
    load_ms: Optional[int] = None
    dom_content_loaded_ms: Optional[int] = None
    ttfb_ms: Optional[int] = None
    fcp_ms: Optional[int] = None
    lcp_ms: Optional[int] = None
    cls: Optional[float] = None
    step_count: int = 0
    retry_count: int = 0
    total_tokens: int = 0
    privacy_mode: str = "metadata_only"
    config_json: Dict[str, Any] = Field(default_factory=dict)
    steps: List[HermesStepRecord] = Field(default_factory=list)
    network: List[HermesNetworkRecord] = Field(default_factory=list)
    findings: List[HermesFinding] = Field(default_factory=list)

