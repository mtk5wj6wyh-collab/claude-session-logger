# Claude Code 工作流配置

## 项目说明

AI 相关文档和工具集合。

## 工作流集成

在开始工作前，请先了解当前工作状态：

1. 读取 `.claude-logs/STATUS.md` 了解当前任务和进度
2. 如果有进行中的任务，优先继续完成
3. 完成任务后运行：`node .claude-tools/task-manager.js done <任务ID>`
4. 发现新待办时运行：`node .claude-tools/task-manager.js add <任务描述>`

### 常用命令

```bash
# 查看当前工作状态
node .claude-tools/task-manager.js status

# 添加新任务
node .claude-tools/task-manager.js add "任务描述"

# 完成任务
node .claude-tools/task-manager.js done <任务ID>

# 更新会话记录和任务状态
node .claude-tools/run.js
```

### 自动任务提取

对话中出现以下关键词时，系统会自动提取为任务：
- `待办：xxx`
- `TODO: xxx`
- `下一步：xxx`
- `需要：xxx`
- `- [ ] xxx`

## 目录结构

```
.claude-tools/      # 工作流脚本
.claude-logs/       # 输出目录
├── STATUS.md       # 当前工作状态（必读）
├── tasks.json      # 任务数据
├── index.md        # 会话索引
├── sessions/       # 会话摘要
└── by-status/      # 按状态分类
```
