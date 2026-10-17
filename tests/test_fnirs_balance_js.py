"""Runs the balance trainer's task bank (dashboard/fnirs-balance.js) under node, if available."""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parents[1] / "dashboard" / "fnirs-balance.js"

SCRIPT = r"""
const {BalanceTasks: T} = require(process.argv[1]);
// Left-to-right calculator for "a op b op c" (tasks use one operator type per prompt)
function calc(expr) {
  const tok = expr.replace(/−/g, '-').replace(/×/g, '*').split(' ');
  let acc = Number(tok[0]);
  for (let i = 1; i < tok.length; i += 2) {
    const op = tok[i], v = Number(tok[i + 1]);
    acc = op === '+' ? acc + v : op === '-' ? acc - v : op === '*' ? acc * v : NaN;
  }
  return acc;
}
const out = {kinds: {}, bad: []};
for (const rec of ['train_left', 'train_right', 'focus']) {
  for (let i = 0; i < 400; i++) {
    const t = T.makeTask(rec);
    out.kinds[rec + ':' + t.kind] = true;
    if (!t.prompt || t.rec !== rec) out.bad.push(['shape', rec, t]);
    if (t.kind === 'answer') {
      if (calc(t.prompt.replace(' = ?', '')) !== t.answer) out.bad.push(['math', t.prompt, t.answer]);
      if (!T.checkAnswer(t, String(t.answer)) || T.checkAnswer(t, String(t.answer + 1))) out.bad.push(['check', t]);
      if (t.answer < 0) out.bad.push(['negative', t]);
    }
    if (t.kind === 'rotation') {
      if (T.checkAnswer(t, t.mirrored ? 'mirror' : 'normal') !== true) out.bad.push(['rotation', t]);
      if (t.angle % 360 === 0) out.bad.push(['upright', t]);
    }
    if (t.kind === 'reveal' && !String(t.answer)) out.bad.push(['reveal', t]);
  }
}
const a = T.makeTask('train_left'), b = T.makeTask('train_left', a.prompt);
out.distinct_ids = a.id !== b.id;
console.log(JSON.stringify(out));
"""


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_task_bank_under_node():
    res = subprocess.run(["node", "-e", SCRIPT, str(JS)], capture_output=True, text=True, timeout=30)
    assert res.returncode == 0, res.stderr
    out = json.loads(res.stdout)
    assert out["bad"] == []
    assert out["distinct_ids"]
    kinds = set(out["kinds"])
    assert {"train_left:answer", "train_left:open", "train_left:reveal"} <= kinds
    assert {"train_right:rotation", "train_right:open", "train_right:reveal"} <= kinds
    assert "focus:focus" in kinds
