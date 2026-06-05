/**
 * parse-session.js — JSONL 解析器
 * 将 Claude Code 的 JSONL 会话文件解析为结构化数据
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析单个 JSONL 会话文件
 * @param {string} jsonlPath - JSONL 文件路径
 * @returns {object} 解析后的结构化数据
 */
function parseSession(jsonlPath) {
  const content = fs.readFileSync(jsonlPath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);

  const session = {
    sessionId: null,
    title: null,
    startTime: null,
    endTime: null,
    cwd: null,
    gitBranch: null,
    model: null,
    messages: [],
    changedFiles: new Set(),
  };

  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch (e) {
      continue; // 跳过格式错误的行
    }

    // 提取会话元数据
    if (!session.sessionId && record.sessionId) {
      session.sessionId = record.sessionId;
    }
    if (!session.cwd && record.cwd) {
      session.cwd = record.cwd;
    }
    if (!session.gitBranch && record.gitBranch) {
      session.gitBranch = record.gitBranch;
    }

    // 时间范围
    if (record.timestamp) {
      const ts = new Date(record.timestamp);
      if (!session.startTime || ts < session.startTime) session.startTime = ts;
      if (!session.endTime || ts > session.endTime) session.endTime = ts;
    }

    switch (record.type) {
      // 用户消息
      case 'user': {
        const textParts = (record.message?.content || [])
          .filter(c => c.type === 'text')
          .map(c => c.text);
        if (textParts.length > 0) {
          session.messages.push({
            role: 'user',
            text: textParts.join('\n'),
            timestamp: record.timestamp,
            promptId: record.promptId,
          });
        }
        break;
      }

      // AI 回复
      case 'assistant': {
        const content = record.message?.content || [];

        // 提取文本内容（过滤 thinking）
        const textParts = content
          .filter(c => c.type === 'text')
          .map(c => c.text);

        // 提取模型信息
        if (record.message?.model && !session.model) {
          session.model = record.message.model;
        }

        // 提取工具调用的文件变更
        const toolCalls = content.filter(c => c.type === 'tool_use');
        for (const tool of toolCalls) {
          if (tool.name === 'Edit' || tool.name === 'Write') {
            const filePath = tool.input?.file_path;
            if (filePath) session.changedFiles.add(filePath);
          }
        }

        if (textParts.length > 0) {
          session.messages.push({
            role: 'assistant',
            text: textParts.join('\n'),
            timestamp: record.timestamp,
          });
        }
        break;
      }

      // AI 生成的标题
      case 'ai-title': {
        if (record.aiTitle && !session.title) {
          session.title = record.aiTitle;
        }
        break;
      }

      // 文件变更快照
      case 'file-history-snapshot': {
        if (record.snapshot?.trackedFileBackups) {
          Object.keys(record.snapshot.trackedFileBackups).forEach(f => {
            session.changedFiles.add(f);
          });
        }
        break;
      }

      // 过滤：queue-operation, attachment, thinking 等
      default:
        break;
    }
  }

  // 去重：转换为相对路径
  const cwd = session.cwd || '';
  const normalized = new Set();
  for (const f of session.changedFiles) {
    let rel = f;
    // 去掉项目根目录前缀
    if (cwd && f.startsWith(cwd)) {
      rel = f.slice(cwd.length).replace(/^[/\\]+/, '');
    }
    // 统一路径分隔符
    rel = rel.replace(/\\/g, '/');
    normalized.add(rel);
  }
  session.changedFiles = Array.from(normalized);
  return session;
}

/**
 * 从路径提取会话 ID
 */
function extractSessionId(filePath) {
  return path.basename(filePath, '.jsonl');
}

module.exports = { parseSession, extractSessionId };
