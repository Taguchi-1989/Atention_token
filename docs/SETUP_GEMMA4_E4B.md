# Gemma4:E4B セットアップガイド (Windows + Ollama)

**対象環境:** Windows 10/11 + Ollama + Gemma4:E4B  
**最終更新:** 2026-04-08

このガイドでは、Attention Ledger プロジェクトを Gemma4:E4B で動作させるためのセットアップ手順を説明します。

---

## 前提条件

セットアップを進める前に、以下の要件を満たしていることを確認してください。

### ハードウェア要件

| 項目 | 推奨スペック | 最小スペック |
|------|------------|-----------|
| OS | Windows 10/11 | Windows 10/11 |
| GPU | NVIDIA RTX 3060 Ti 以上 | RTX 3060 Ti (8GB VRAM) |
| VRAM | 12GB 以上 | 8GB 以上 |
| メモリ (RAM) | 64GB | 32GB 以上 |
| ストレージ | 10GB 以上の空き容量 | 10GB 以上 |

**注意:** RTX 4090 がある場合は後述の高精度量子化 (BF16) も利用可能です。

### ソフトウェア要件

- Windows PowerShell または Command Prompt
- インターネット接続 (モデルダウンロード用)
- Python 3.10 以上 (python/要件参照)

---

## Step 1: Ollama のインストール

### インストール手順

1. [ollama.com](https://ollama.com) にアクセス
2. **Windows** のダウンロードボタンをクリック
3. インストーラーを実行
4. デフォルト設定で完了

### インストール確認

PowerShell または Command Prompt を開いて、以下のコマンドを実行してください:

```bash
ollama --version
```

**期待される出力例:**
```
ollama version is 0.6.0
```

バージョン番号が表示されれば、インストール成功です。

---

## Step 2: Gemma4:E4B モデルのダウンロード

### モデルのプル

PowerShell で以下を実行します:

```bash
ollama pull gemma4:e4b
```

### ダウンロード情報

- **ファイルサイズ:** 約 9.6GB
- **ダウンロード時間:** インターネット速度に依存 (100Mbps で約 10 分程度)
- **ディスク使用量:** ~9.6GB (インストール後)

ダウンロード中の進捗表示例:
```
pulling manifest
pulling 75d52e1797fd
pulling fa6c50f82d4a
... (複数の層をダウンロード)
```

### モデルの確認

ダウンロード完了後、インストール済みモデルを確認します:

```bash
ollama list
```

**期待される出力:**
```
NAME              ID              SIZE      MODIFIED
gemma4:e4b        1234567890ab    9.6GB     2 hours ago
```

---

## Step 3: 古いモデルのクリーンアップ (オプション)

以前のプロジェクト実行で他のモデルをインストールしている場合、ストレージを節約するために削除できます。

### 削除対象モデル例

```bash
ollama rm gemma3:4b
ollama rm qwen3:4b
ollama rm qwen3-vl:4b
```

### 確認

削除後に再度確認:

```bash
ollama list
```

---

## Step 4: モデルの動作確認

### 基本的なテスト

以下のコマンドでモデルが正常に動作することを確認します:

```bash
ollama run gemma4:e4b "Hello, respond with just OK"
```

**期待される出力:**
```
OK
```

応答が返ってくれば、モデルは正常に動作しています。

### より詳しいテスト

日本語での動作確認:

```bash
ollama run gemma4:e4b "こんにちは、簡潔に挨拶してください。"
```

**期待される出力例:**
```
こんにちは。お疲れ様です。
```

---

## Step 5: Attention Ledger での実行

### プロジェクト設定確認

プロジェクトは既に `gemma4:e4b` をデフォルトモデルとして設定しています。

**設定ファイル:** `python/attention_ledger/core/llm/config.py`

```python
class Settings:
    model_name = "gemma4:e4b"  # デフォルトモデル
    ollama_url = "http://localhost:11434"  # Ollama サーバー
    temperature = 0.7
```

### スモークテスト実行

プロジェクトディレクトリに移動して、スモークテストを実行します:

```bash
cd python
python -m pytest tests/test_gemma4_smoke.py -v
```

**期待される出力:**
```
tests/test_gemma4_smoke.py::test_gemma4_basic PASSED
tests/test_gemma4_smoke.py::test_gemma4_response PASSED
======================== 2 passed in 3.45s ========================
```

### タスク実行例

#### ベースライン作成

```bash
python -m attention_ledger baseline create BL-GEMMA4-E4B \
  --model gemma4:e4b \
  --engine ollama \
  --temperature 0.7
```

#### タスク実行

```bash
python -m attention_ledger task run expense_v1 --baseline BL-GEMMA4-E4B
```

#### 完全な実行例

```bash
cd python

# ベースライン作成
python -m attention_ledger baseline create BL-TEST \
  --model gemma4:e4b \
  --engine ollama

# タスク実行
python -m attention_ledger task run expense_v1 --baseline BL-TEST

# 結果確認
python -m attention_ledger report diff --baseline1 BL-TEST --baseline2 baseline_default
```

---

## モデルバリアント参照表

Gemma4 には複数の量子化バージョンがあります。以下の表から環境に合わせて選択できます:

| タグ | ファイルサイズ | 量子化方式 | 推奨環境 | 用途 |
|-----|-------------|---------|--------|------|
| **gemma4:e4b** (推奨) | 9.6GB | Q4_K_M | RTX 3060 Ti 以上 (8GB VRAM) | バランス型、高速 |
| gemma4:e4b-it-q8_0 | 12GB | Q8 | RTX 4070 Ti 以上 (12GB VRAM) | 高精度 |
| gemma4:e4b-it-bf16 | 16GB | BF16 (完全精度) | RTX 4090 (24GB VRAM) | 最高品質 |

### 別のモデルに変更する場合

```bash
# モデルをプル
ollama pull gemma4:e4b-it-q8_0

# 実行時にモデルを指定
python -m attention_ledger baseline create BL-Q8 \
  --model gemma4:e4b-it-q8_0 \
  --engine ollama
```

---

## トラブルシューティング

### 問題: Ollama が応答しない / 接続エラーが出る

**症状:**
```
ConnectionError: Failed to connect to http://localhost:11434
```

**解決策:**

1. Ollama サーバーが起動しているか確認
2. PowerShell を開いて Ollama を明示的に起動:
   ```bash
   ollama serve
   ```
3. 別のターミナルで再度実行

### 問題: メモリ不足エラー (Out of Memory)

**症状:**
```
CUDA out of memory
Error: model memory allocation failed
```

**解決策:**

1. GPU メモリを使用している他のアプリを閉じる
   - ブラウザ (Chrome、Firefox など)
   - 3D グラフィックスアプリ (Unity、Unreal など)
   - 他の AI モデル

2. より軽量なモデルに変更:
   ```bash
   ollama pull gemma3:4b  # より小さいモデル
   ```

3. Windows メモリ管理の確認:
   - タスクマネージャーで CPU/GPU 使用率を確認
   - バックグラウンドプロセスを終了

### 問題: タイムアウトエラー

**症状:**
```
asyncio.TimeoutError: Waiting for response timed out (120s)
```

**原因:** モデルが複雑な処理に時間を要している

**解決策:**

1. より単純なプロンプトでテスト:
   ```bash
   ollama run gemma4:e4b "Hello"
   ```

2. 他のアプリを終了して GPU リソースを解放

3. タイムアウト値を増やす場合は `adapter.py` を編集:
   ```python
   # adapter.py の 27 行目付近
   self._client = httpx.AsyncClient(timeout=180.0)  # 120s → 180s に変更
   ```

### 問題: モデルダウンロードが失敗する

**症状:**
```
Error pulling model: download failed
```

**解決策:**

1. インターネット接続を確認
2. Ollama を再起動:
   ```bash
   ollama serve
   ```
3. 再度プル:
   ```bash
   ollama pull gemma4:e4b
   ```

### 問題: モデルの応答が遅い

**原因:** GPU が十分に活用されていない可能性

**確認方法:**

1. PowerShell で実行中のプロセスを確認:
   ```bash
   nvidia-smi  # NVIDIA GPU をお持ちの場合
   ```

2. **gpu_memory_fraction** を確認:
   - Ollama は自動的に GPU メモリを最適化しますが、競合アプリがある場合は遅くなる可能性があります

3. 単一プロセス実行に限定:
   ```bash
   # 一度に 1 つのタスクだけ実行
   python -m attention_ledger task run expense_v1 --baseline BL-GEMMA4-E4B
   ```

---

## ログとデバッグ

### Ollama のログ確認

Ollama サーバーをフォアグラウンドで実行してログを確認:

```bash
ollama serve
```

このコマンドを実行するとログが標準出力に表示されます:
```
[GIN] 2026/04/08 12:34:56 POST /api/generate 200 2345ms
```

### Python ログレベル設定

テスト実行時にログレベルを設定:

```bash
# Python デバッグモード
python -m pytest tests/test_gemma4_smoke.py -v --log-cli-level=DEBUG
```

---

## パフォーマンスチューニング

### 推奨設定 (RTX 3060 Ti)

```bash
# 温度 (creativity) を調整
python -m attention_ledger baseline create BL-TUNED \
  --model gemma4:e4b \
  --engine ollama \
  --temperature 0.5  # より決定的 (0.0-1.0)
```

| temperature | 特徴 | 用途 |
|------------|------|------|
| 0.3-0.5 | 一貫性、決定的 | テスト、検証 |
| 0.7 | バランス型 (デフォルト) | 一般的なタスク |
| 0.9-1.0 | 多様性、クリエイティブ | 探索的なタスク |

### メモリ最適化

複数のベースラインを並列実行する場合:

```bash
# 順序実行 (メモリ効率重視)
python -m attention_ledger task run expense_v1 --baseline BL-1
python -m attention_ledger task run expense_v1 --baseline BL-2
```

---

## 次のステップ

- セットアップが完了したら、[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) でプロジェクト全体の構成を確認
- [ROADMAP.md](./ROADMAP.md) で今後の計画を確認
- [EXPERIMENT_RESULTS.md](./EXPERIMENT_RESULTS.md) で実験結果を参照

---

## FAQ

**Q: Ollama は毎回起動する必要がありますか?**  
A: はい。`ollama serve` コマンドでサーバーを起動してから Attention Ledger を実行してください。バックグラウンドサービスとしても実行可能です。

**Q: Ollama のデフォルトポートを変更できますか?**  
A: はい。環境変数 `OLLAMA_HOST` で指定後、config.py の `ollama_url` を変更してください。

**Q: 複数モデルを同時に実行できますか?**  
A: 推奨しません。メモリ不足のリスクがあります。順次実行をお勧めします。

**Q: Apple Silicon Mac でも動作しますか?**  
A: はい、Ollama は Mac でも動作します。このガイドを Mac 向けに調整した別ドキュメントがあれば参照してください。

---

## 参考リンク

- [Ollama 公式ドキュメント](https://github.com/ollama/ollama)
- [Gemma モデルカード (Google)](https://ai.google.dev/gemma)
- [Attention Ledger README](../python/README.md)
