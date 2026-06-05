/**
 * infer-status.js — 任务状态推断
 * 基于会话内容推断任务状态：completed / in-progress / interrupted / unknown
 */

/**
 * 推断会话状态
 * @param {object} session - parseSession 返回的结构化数据
 * @returns {string} 状态标记
 */
function inferStatus(session) {
  const { messages } = session;
  if (!messages || messages.length === 0) return 'unknown';

  const lastMsg = messages[messages.length - 1];
  const lastText = lastMsg?.text || '';

  // 完成信号
  const completionSignals = [
    /已完成|已实现|已完成|done|completed|finished/i,
    /所有测试通过|all tests pass/i,
    /没有更多问题|no more issues/i,
    /已更新|updated|已修复|fixed/i,
    /修改完成|创建完成|添加完成/i,
  ];

  // 进行中信号
  const pendingSignals = [
    /待办|todo|pending|需要后续/i,
    /下一步|next step/i,
    /暂时到这里|stop here for now/i,
    /继续|continue/i,
  ];

  // 中断信号（用户消息结尾，说明 AI 还没回复完）
  const isInterrupted = lastMsg.role === 'user';

  // 综合判断
  if (!isInterrupted && completionSignals.some(s => s.test(lastText))) {
    return 'completed';
  }
  if (pendingSignals.some(s => s.test(lastText))) {
    return 'in-progress';
  }
  if (isInterrupted) {
    return 'interrupted';
  }

  // 默认：最后一条是 AI 回复，视为完成
  if (lastMsg.role === 'assistant') {
    return 'completed';
  }

  return 'unknown';
}

/**
 * 获取状态的中文标签和 emoji
 */
function getStatusLabel(status) {
  const labels = {
    'completed': '✅ 已完成',
    'in-progress': '🔄 进行中',
    'interrupted': '⚠️ 已中断',
    'unknown': '❓ 未知',
  };
  return labels[status] || labels.unknown;
}

module.exports = { inferStatus, getStatusLabel };
