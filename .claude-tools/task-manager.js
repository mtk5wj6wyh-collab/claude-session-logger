/**
 * task-manager.js — 工作流任务管理
 *
 * 核心理念：不是记录日志，而是跟踪工作进度
 * - 当前要做什么
 * - 历史做了什么
 * - 后面还要做什么
 * - 自动从对话中提取新增任务
 */

const fs = require('fs');
const path = require('path');

const TASKS_FILE = path.join(process.cwd(), '.claude-logs', 'tasks.json');

/**
 * 任务结构
 * {
 *   id: string,
 *   title: string,
 *   status: 'todo' | 'in-progress' | 'done',
 *   createdAt: string,
 *   updatedAt: string,
 *   completedAt: string | null,
 *   source: 'manual' | 'auto',  // 手动添加 或 从对话自动提取
 *   sessionId: string | null,    // 来源会话
 *   tags: string[],
 * }
 */

function loadTasks() {
  try {
    return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
  } catch {
    return { tasks: [], history: [] };
  }
}

function saveTasks(data) {
  const dir = path.dirname(TASKS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 添加任务
 */
function addTask(title, options = {}) {
  const data = loadTasks();
  const task = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    status: options.status || 'todo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    source: options.source || 'manual',
    sessionId: options.sessionId || null,
    tags: options.tags || [],
  };
  data.tasks.push(task);
  saveTasks(data);
  return task;
}

/**
 * 更新任务状态
 */
function updateTask(id, updates) {
  const data = loadTasks();
  const task = data.tasks.find(t => t.id === id);
  if (!task) return null;

  Object.assign(task, updates, { updatedAt: new Date().toISOString() });

  if (updates.status === 'done' && !task.completedAt) {
    task.completedAt = new Date().toISOString();
  }

  saveTasks(data);
  return task;
}

/**
 * 完成任务
 */
function completeTask(id) {
  return updateTask(id, { status: 'done', completedAt: new Date().toISOString() });
}

/**
 * 获取当前工作状态（用于上下文恢复）
 */
function getCurrentStatus() {
  const data = loadTasks();
  const inProgress = data.tasks.filter(t => t.status === 'in-progress');
  const todo = data.tasks.filter(t => t.status === 'todo');
  const recentDone = data.tasks
    .filter(t => t.status === 'done')
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
    .slice(0, 5);

  return { inProgress, todo, recentDone };
}

/**
 * 生成工作状态 Markdown（用于 CLAUDE.md 或手动查看）
 */
function generateStatusMarkdown() {
  const { inProgress, todo, recentDone } = getCurrentStatus();

  let md = `# 工作状态

> 自动生成于 ${new Date().toLocaleString('zh-CN')}

## 🔄 当前进行中
${inProgress.length === 0 ? '_无_' : inProgress.map(t => `- [ ] ${t.title}`).join('\n')}

## 📋 待办
${todo.length === 0 ? '_无_' : todo.map(t => `- [ ] ${t.title}`).join('\n')}

## ✅ 最近完成
${recentDone.length === 0 ? '_无_' : recentDone.map(t => `- [x] ${t.title} (${t.completedAt?.slice(0, 10)})`).join('\n')}
`;

  return md;
}

/**
 * 从对话内容自动提取任务
 * 识别模式：待办、TODO、下一步、需要、计划等
 * 只处理用户消息，忽略 AI 回复和代码块
 */
function extractTasksFromConversation(messages, sessionId) {
  // 显式任务标记（适用于所有消息）
  const explicitPatterns = [
    /(?:待办|TODO|todo)[：:]\s*(.+)/gi,
    /(?:下一步|next step)[：:]\s*(.+)/gi,
    /(?:需要|need to)[：:]\s*(.+)/gi,
    /(?:计划|plan)[：:]\s*(.+)/gi,
    /(?:后续|follow-up)[：:]\s*(.+)/gi,
    /-\s*\[\s*\]\s*(.+)/g,  // Markdown checkbox
  ];

  // 自然语言请求（仅用于用户消息开头）
  const naturalPatterns = [
    /^(?:帮我|帮|请你|请|我想|能不能|可以|麻烦)\s*(.{5,60})$/gm,
    /^(?:help me|please|can you|could you|I need|I want)\s+(.{5,60})$/gmi,
  ];

  const extracted = [];

  // 1. 从所有文本中提取显式标记
  const allText = messages.map(m => m.text || '').join('\n');
  for (const pattern of explicitPatterns) {
    let match;
    while ((match = pattern.exec(allText)) !== null) {
      const task = match[1].trim();
      // 过滤掉明显不是任务的内容
      if (isValidTask(task)) {
        extracted.push(task);
      }
    }
  }

  // 2. 只从用户消息中提取自然语言请求
  const userMessages = messages.filter(m => m.role === 'user');
  for (const msg of userMessages) {
    const text = (msg.text || '')
      .replace(/<ide_opened_file>.*?<\/ide_opened_file>/gs, '')  // 移除 IDE 标签
      .replace(/<ide_selection>.*?<\/ide_selection>/gs, '')       // 移除选中内容
      .trim();

    if (!text) continue;

    for (const pattern of naturalPatterns) {
      // 重置正则状态
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const task = match[1].trim();
        if (isValidTask(task)) {
          extracted.push(task);
        }
      }
    }
  }

  // 去重并添加
  const data = loadTasks();
  const existingTitles = new Set(data.tasks.map(t => t.title));

  const newTasks = [];
  for (const title of extracted) {
    if (!existingTitles.has(title) && title.length >= 4 && title.length <= 100) {
      const task = addTask(title, { source: 'auto', sessionId });
      newTasks.push(task);
    }
  }

  return newTasks;
}

/**
 * 验证是否是有效的任务描述
 */
function isValidTask(text) {
  // 过滤掉代码、markdown、技术内容
  const invalidPatterns = [
    /[`{}\[\]<>]/,           // 代码符号
    /^https?:\/\//,          // URL
    /^\*+/,                  // markdown 强调
    /^#{1,6}\s/,             // markdown 标题
    /\|[+-]/,                // markdown 表格
    /^- \[[ x]\]/,           // 已经是 checkbox（单独处理）
    /\.(js|ts|py|html|css|json|md)$/,  // 文件名
    /^(const|let|var|function|class|import|export)/,  // 代码关键字
    /^(if|else|for|while|return|switch|case)/,         // 代码关键字
    /^\s*(\/\/|\/\*|\*\/)/,  // 注释
    /^[\s]*```/,             // 代码块
  ];

  return !invalidPatterns.some(p => p.test(text));
}

/**
 * 从会话 JSONL 自动更新任务状态
 */
function syncFromSession(session) {
  const { messages, sessionId } = session;

  // 1. 提取新任务
  const newTasks = extractTasksFromConversation(messages, sessionId);

  // 2. 检测"完成"信号，更新进行中的任务
  const data = loadTasks();
  const lastMsg = messages[messages.length - 1];

  if (lastMsg?.role === 'assistant') {
    const completionSignals = /已完成|已实现|done|completed|finished|已修复|已添加|已创建/;
    if (completionSignals.test(lastMsg.text)) {
      // 将当前进行中的任务标记为完成
      const inProgress = data.tasks.filter(t => t.status === 'in-progress');
      for (const task of inProgress) {
        completeTask(task.id);
      }
    }
  }

  return newTasks;
}

// 命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  switch (cmd) {
    case 'add':
      const task = addTask(args.slice(1).join(' '));
      console.log(`已添加任务: ${task.title}`);
      break;

    case 'done':
      const completed = completeTask(args[1]);
      console.log(`已完成: ${completed?.title || '未找到'}`);
      break;

    case 'status':
      console.log(generateStatusMarkdown());
      break;

    case 'list':
      const data = loadTasks();
      console.log(JSON.stringify(data, null, 2));
      break;

    default:
      console.log(`用法:
  node task-manager.js add <任务标题>
  node task-manager.js done <任务ID>
  node task-manager.js status
  node task-manager.js list`);
  }
}

module.exports = {
  addTask, updateTask, completeTask,
  getCurrentStatus, generateStatusMarkdown,
  extractTasksFromConversation, syncFromSession,
  loadTasks, saveTasks
};
