/**
 * run.js — 主入口
 * 扫描新会话 → 解析 → 生成摘要 → 更新索引 → 同步任务
 */

const { scanAndProcess } = require('./scan-sessions');
const { generateMainIndex, generateStatusIndexes, collectSessionMeta } = require('./update-index');
const { syncFromSession, generateStatusMarkdown, getCurrentStatus } = require('./task-manager');
const { parseSession } = require('./parse-session');
const fs = require('fs');
const path = require('path');
const os = require('os');

function main() {
  console.log('=== Claude Code 工作流系统 ===');
  console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('');

  // 1. 扫描并处理新会话
  console.log('[1/4] 扫描会话...');
  const results = scanAndProcess();
  console.log(`  处理了 ${results.length} 个会话`);
  console.log('');

  // 2. 从会话中同步任务
  console.log('[2/4] 同步任务...');
  const projectDir = path.join(os.homedir(), '.claude', 'projects', process.cwd().replace(/[:\\\/]/g, '-'));
  let newTasksCount = 0;

  if (fs.existsSync(projectDir)) {
    const jsonlFiles = fs.readdirSync(projectDir)
      .filter(f => f.endsWith('.jsonl'))
      .slice(-3);  // 只处理最近 3 个会话

    for (const file of jsonlFiles) {
      try {
        const session = parseSession(path.join(projectDir, file));
        const newTasks = syncFromSession(session);
        newTasksCount += newTasks.length;
      } catch (e) {
        // 忽略解析错误
      }
    }
  }
  console.log(`  新增 ${newTasksCount} 个任务`);
  console.log('');

  // 3. 更新会话索引
  console.log('[3/4] 更新索引...');
  const sessions = collectSessionMeta();
  generateMainIndex(sessions);
  generateStatusIndexes(sessions);
  console.log('  索引更新完成');
  console.log('');

  // 4. 生成工作状态文件
  console.log('[4/4] 更新工作状态...');
  const statusMd = generateStatusMarkdown();
  const statusFile = path.join(process.cwd(), '.claude-logs', 'STATUS.md');
  fs.writeFileSync(statusFile, statusMd, 'utf-8');
  console.log('  STATUS.md 已更新');
  console.log('');

  // 输出当前状态摘要
  const { inProgress, todo, recentDone } = getCurrentStatus();
  console.log('=== 当前工作状态 ===');
  if (inProgress.length > 0) {
    console.log(`🔄 进行中: ${inProgress.map(t => t.title).join(', ')}`);
  }
  if (todo.length > 0) {
    console.log(`📋 待办: ${todo.length} 个任务`);
  }
  console.log(`✅ 已完成: ${recentDone.length} 个任务`);
  console.log('');

  return results;
}

if (require.main === module) {
  main();
}

module.exports = { main };
