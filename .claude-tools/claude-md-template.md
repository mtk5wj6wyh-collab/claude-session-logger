## 工作流集成

在开始工作前，请先了解当前工作状态：

1. 读取 `.claude-logs/STATUS.md` 了解当前任务
2. 如果有进行中的任务，优先继续
3. 完成任务后，运行 `node .claude-tools/task-manager.js done <任务ID>`
4. 发现新待办时，运行 `node .claude-tools/task-manager.js add <任务描述>`

### 任务管理命令

```bash
# 查看当前状态
node .claude-tools/task-manager.js status

# 添加任务
node .claude-tools/task-manager.js add 实现数据管道读取模块

# 完成任务
node .claude-tools/task-manager.js done <任务ID>

# 同步会话中的任务
node .claude-tools/run.js
```

### 自动提取的关键词

系统会自动从对话中提取以下模式的任务：
- `待办：xxx`
- `TODO: xxx`
- `下一步：xxx`
- `需要：xxx`
- `计划：xxx`
- `- [ ] xxx`（Markdown checkbox）
