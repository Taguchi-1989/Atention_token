# Task YAML スキーマ（v0.1）

MVP用のタスク定義フォーマットです。

---

## 必須フィールド

```yaml
task_id: string
description: string
start_condition: string
goal_condition: string
input_data: object
```

---

## 推奨フィールド

```yaml
ui_variant: string   # "A" / "B" など
steps_hint: string   # 例: "経費 > 新規作成 > 交通費"
```

---

## 例

```yaml
task_id: EXPENSE_INPUT_V1
description: 経費精算の交通費入力
start_condition: logged_in_home
goal_condition: expense_saved
ui_variant: A
steps_hint: 経費 > 新規作成 > 交通費
input_data:
  date: 2026-04-01
  amount: 1280
  route: 東京-新宿
```

---

## バリデーションルール（MVP）

- task_id は一意
- input_data は空でもよいが、固定値が望ましい
- start_condition と goal_condition は文字列で良い（実装は後で解釈）

