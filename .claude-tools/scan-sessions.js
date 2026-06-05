/**
 * scan-sessions.js — 会话扫描器
 * 扫描 Claude Code 的原始 JSONL 文件，检测并处理新会话
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseSession } = require('./parse-session');
const { generateSummary, generateFilename } = require('./generate-summary');

// 配置
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const OUTPUT_DIR = path.join(process.cwd(), '.claude-logs');
const SESSIONS_DIR = path.join(OUTPUT_DIR, 'sessions');
const PROCESSED_FILE = path.join(OUTPUT_DIR, '.processed.json');

/**
 * 获取当前项目对应的 Claude Code 数据目录
 */
function getProjectDataDir() {
  const cwd = process.cwd();
  // 路径编码: d:\idq\Doc\Ai → d--idq-Doc-Ai
  const encoded = cwd.replace(/[:\\\/]/g, '-');
  return path.join(CLAUDE_PROJECTS_DIR, encoded);
}

/**
 * 获取已处理的会话记录
 */
function getProcessedSessions() {
  try {
    return JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * 标记会话为已处理
 */
function markProcessed(sessionId, filename, mtime) {
  const processed = getProcessedSessions();
  processed[sessionId] = {
    filename,
    processedAt: new Date().toISOString(),
    mtime: mtime || Date.now(),
  };
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(processed, null, 2));
}

/**
 * 检查会话是否需要重新处理（文件有更新）
 */
function needsReprocess(sessionId, jsonlPath, processed) {
  // 未处理过
  if (!processed[sessionId]) return true;

  // 检查文件修改时间
  const stat = fs.statSync(jsonlPath);
  const lastMtime = processed[sessionId].mtime || 0;
  return stat.mtimeMs > lastMtime;
}

/**
 * 扫描并处理新会话
 */
function scanAndProcess() {
  const projectDir = getProjectDataDir();

  if (!fs.existsSync(projectDir)) {
    console.log(`项目数据目录不存在: ${projectDir}`);
    return [];
  }

  // 确保输出目录存在
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });

  // 读取所有 JSONL 文件
  const jsonlFiles = fs.readdirSync(projectDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => path.join(projectDir, f));

  const processed = getProcessedSessions();
  const results = [];

  for (const jsonlPath of jsonlFiles) {
    const sessionId = path.basename(jsonlPath, '.jsonl');

    // 跳过已处理且未更新的
    if (!needsReprocess(sessionId, jsonlPath, processed)) {
      continue;
    }

    try {
      const isUpdate = !!processed[sessionId];
      console.log(`${isUpdate ? '更新' : '处理新'}会话: ${sessionId}`);

      const session = parseSession(jsonlPath);
      const { md, status } = generateSummary(session);
      const filename = generateFilename(session);

      // 写入摘要文件
      const outputPath = path.join(SESSIONS_DIR, filename);
      fs.writeFileSync(outputPath, md, 'utf-8');

      // 标记为已处理（记录文件修改时间）
      const stat = fs.statSync(jsonlPath);
      markProcessed(sessionId, filename, stat.mtimeMs);

      results.push({ sessionId, filename, status });
      console.log(`  -> ${filename} [${status}]`);
    } catch (err) {
      console.error(`处理失败 ${sessionId}:`, err.message);
    }
  }

  return results;
}

// 命令行执行
if (require.main === module) {
  console.log('扫描会话...');
  console.log(`项目目录: ${getProjectDataDir()}`);
  console.log(`输出目录: ${SESSIONS_DIR}`);
  console.log('---');

  const results = scanAndProcess();

  if (results.length === 0) {
    console.log('没有新会话需要处理');
  } else {
    console.log(`\n处理完成: ${results.length} 个会话`);
  }
}

module.exports = { scanAndProcess, getProjectDataDir };
