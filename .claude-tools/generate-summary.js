/**
 * generate-summary.js — Markdown 摘要生成器
 * 将解析后的会话数据生成可读的 Markdown 摘要
 */

const { inferStatus, getStatusLabel } = require('./infer-status');

/**
 * 格式化时间戳
 */
function formatTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化日期（用于文件名）
 */
function formatDate(ts) {
  if (!ts) return 'unknown';
  const d = new Date(ts);
  return d.toISOString().slice(0, 10).replace(/-/g, '-');
}

/**
 * 格式化时间（用于文件名）
 */
function formatTimeShort(ts) {
  if (!ts) return '0000';
  const d = new Date(ts);
  return d.toISOString().slice(11, 16).replace(':', '');
}

/**
 * 截断文本
 */
function truncate(text, maxLen = 200) {
  if (!text) return '';
  text = text.replace(/\n/g, ' ').trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

/**
 * 生成会话摘要的 Markdown 内容
 * @param {object} session - parseSession 返回的结构化数据
 * @returns {string} Markdown 内容
 */
function generateSummary(session) {
  const status = inferStatus(session);
  const statusLabel = getStatusLabel(status);

  // 提取用户目标（第一条用户消息）
  const firstUserMsg = session.messages.find(m => m.role === 'user');
  const userGoal = firstUserMsg ? truncate(firstUserMsg.text, 300) : '-';

  // 提取关键对话摘要（最多 10 条）
  const dialogSummary = session.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(0, 20)
    .map(m => {
      const time = formatTime(m.timestamp);
      const role = m.role === 'user' ? '用户' : 'AI';
      const text = truncate(m.text, 150);
      return `| ${time} | ${role} | ${text} |`;
    })
    .join('\n');

  // 文件变更列表
  const fileList = session.changedFiles.length > 0
    ? session.changedFiles.map(f => `- \`${f}\``).join('\n')
    : '- 无文件变更';

  const md = `# 会话摘要

## 元信息
- **会话ID**: ${session.sessionId || '-'}
- **项目**: ${session.cwd || '-'}
- **分支**: ${session.gitBranch || '-'}
- **开始时间**: ${formatTime(session.startTime)}
- **结束时间**: ${formatTime(session.endTime)}
- **模型**: ${session.model || '-'}
- **状态**: ${statusLabel}

## 用户目标
> ${userGoal}

## 代码变更
${fileList}

## 对话摘要
| 时间 | 角色 | 内容摘要 |
|------|------|----------|
${dialogSummary}

---
*自动生成于 ${new Date().toISOString()}*
`;

  return { md, status };
}

/**
 * 生成会话文件名
 */
function generateFilename(session) {
  const date = formatDate(session.startTime);
  const time = formatTimeShort(session.startTime);
  const title = (session.title || 'untitled')
    .replace(/[<>:"/\\|?*]/g, '-')  // 移除非法字符
    .slice(0, 50);                   // 截断
  return `${date}_${time}_${title}.md`;
}

module.exports = { generateSummary, generateFilename, getStatusLabel };
