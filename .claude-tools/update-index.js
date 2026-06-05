/**
 * update-index.js — 索引更新器
 * 更新 .claude-logs/ 下的索引文件
 */

const fs = require('fs');
const path = require('path');
const { parseSession } = require('./parse-session');
const { generateSummary, generateFilename, getStatusLabel } = require('./generate-summary');

const OUTPUT_DIR = path.join(process.cwd(), '.claude-logs');
const SESSIONS_DIR = path.join(OUTPUT_DIR, 'sessions');

/**
 * 扫描所有已生成的摘要文件，提取元信息
 */
function collectSessionMeta() {
  if (!fs.existsSync(SESSIONS_DIR)) return [];

  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.md'));
  const sessions = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');

    // 简单解析元信息
    const meta = {
      filename: file,
      sessionId: extractField(content, '会话ID'),
      project: extractField(content, '项目'),
      branch: extractField(content, '分支'),
      startTime: extractField(content, '开始时间'),
      endTime: extractField(content, '结束时间'),
      model: extractField(content, '模型'),
      status: extractStatus(content),
      goal: extractGoal(content),
    };
    sessions.push(meta);
  }

  // 按时间倒序
  sessions.sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));
  return sessions;
}

function extractField(content, fieldName) {
  const match = content.match(new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(.+)`));
  return match ? match[1].trim() : '-';
}

function extractStatus(content) {
  const match = content.match(/\*\*状态\*\*:\s*(.+)/);
  if (!match) return 'unknown';
  const text = match[1];
  if (text.includes('已完成')) return 'completed';
  if (text.includes('进行中')) return 'in-progress';
  if (text.includes('已中断')) return 'interrupted';
  return 'unknown';
}

function extractGoal(content) {
  const match = content.match(/>\s*(.+)/);
  return match ? match[1].trim().slice(0, 100) : '-';
}

/**
 * 生成主索引
 */
function generateMainIndex(sessions) {
  const lines = sessions.map(s => {
    return `- [${s.startTime}] [${getStatusLabel(s.status)}] ${s.goal} → [\`${s.filename}\`](sessions/${s.filename})`;
  });

  const md = `# 会话历史索引

> 自动生成，请勿手动编辑

| 时间 | 状态 | 目标 | 文件 |
|------|------|------|------|
${sessions.map(s => `| ${s.startTime} | ${getStatusLabel(s.status)} | ${s.goal} | [\`${s.filename}\`](sessions/${s.filename}) |`).join('\n')}

---
*共 ${sessions.length} 个会话，更新于 ${new Date().toLocaleString('zh-CN')}*
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.md'), md, 'utf-8');
}

/**
 * 按状态分类生成索引
 */
function generateStatusIndexes(sessions) {
  const byStatusDir = path.join(OUTPUT_DIR, 'by-status');
  fs.mkdirSync(byStatusDir, { recursive: true });

  const groups = {
    'completed': [],
    'in-progress': [],
    'interrupted': [],
    'unknown': [],
  };

  for (const s of sessions) {
    const key = groups[s.status] ? s.status : 'unknown';
    groups[key].push(s);
  }

  for (const [status, items] of Object.entries(groups)) {
    const md = `# ${getStatusLabel(status)}

${items.length === 0 ? '_暂无_' : items.map(s =>
`- [${s.startTime}] ${s.goal} → [\`${s.filename}\`](../sessions/${s.filename})`
).join('\n')}
`;
    fs.writeFileSync(path.join(byStatusDir, `${status}.md`), md, 'utf-8');
  }
}

// 命令行执行
if (require.main === module) {
  console.log('更新索引...');
  const sessions = collectSessionMeta();
  console.log(`找到 ${sessions.length} 个会话摘要`);

  generateMainIndex(sessions);
  generateStatusIndexes(sessions);

  console.log('索引更新完成');
}

module.exports = { collectSessionMeta, generateMainIndex, generateStatusIndexes };
