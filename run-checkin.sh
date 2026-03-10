#!/bin/bash
cd /Users/robert/Projects/anyrouter

NODE="/Users/robert/.local/share/fnm/node-versions/v24.13.1/installation/bin/node"
LOG="/Users/robert/Projects/anyrouter/checkin.log"

# Run checkin
"$NODE" checkin.js

# Send per-account macOS notifications — click to open log
"$NODE" -e "
const fs = require('fs');
try {
  const s = JSON.parse(fs.readFileSync('checkin-summary.json', 'utf-8'));
  if (s.skipped) {
    console.log(JSON.stringify({ title: 'AnyRouter 签到', msg: '已跳过: ' + (s.skipReason || '') }));
  } else {
    (s.accounts || []).forEach(a => {
      const status = a.success ? '签到成功' : '签到失败';
      const detail = a.success ? '余额: ' + a.balance : '错误: ' + (a.error || '未知');
      console.log(JSON.stringify({ title: 'AnyRouter - ' + a.name, msg: status + ' | ' + detail }));
    });
  }
} catch(e) {
  console.log(JSON.stringify({ title: 'AnyRouter 签到', msg: '签到完成' }));
}
" 2>/dev/null | while IFS= read -r line; do
  TITLE=$(echo "$line" | "$NODE" -e "process.stdin.on('data',d=>console.log(JSON.parse(d).title))")
  MSG=$(echo "$line" | "$NODE" -e "process.stdin.on('data',d=>console.log(JSON.parse(d).msg))")
  /opt/homebrew/bin/terminal-notifier \
    -title "$TITLE" \
    -message "$MSG" \
    -open "file://$LOG" \
    -sound default
done
