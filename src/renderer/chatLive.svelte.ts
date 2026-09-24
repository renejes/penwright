/**
 * The in-progress assistant turn. Tokens land in a plain object.
 * The bubble reads `$state` fields that update once per animation frame,
 * so the editor never re-renders per token.
 */
import {
  applyTurnAssistantText,
  applyTurnStatus,
  applyTurnSummary,
  applyTurnThinking,
  applyTurnTool,
  isRunFailure,
} from '../shared/chatStream';
import type { ChatStreamEvent, ChatTurn } from '../shared/chatTypes';

class ChatLive {
  text = $state('');
  thinking = $state('');
  toolName = $state('');
  error = $state('');
  /** Bumps once per painted frame so the thread can follow the bottom. */
  frame = $state(0);

  private shadow: ChatTurn = { id: 'live', role: 'assistant', text: '', log: [] };
  private raf = 0;

  begin(): void {
    this.cancelFrame();
    this.shadow = { id: 'live', role: 'assistant', text: '', log: [] };
    this.text = '';
    this.thinking = '';
    this.toolName = '';
    this.error = '';
  }

  ingest(event: ChatStreamEvent): void {
    switch (event.kind) {
      case 'assistant':
        applyTurnAssistantText(this.shadow, event.text, 'snapshot');
        break;
      case 'assistant-delta':
        applyTurnAssistantText(this.shadow, event.text, 'delta');
        break;
      case 'thinking':
        applyTurnThinking(this.shadow, event.text);
        break;
      case 'tool':
        applyTurnTool(this.shadow, {
          id: event.id,
          name: event.name,
          status: event.status,
          detail: event.detail,
        });
        break;
      case 'status':
        if (!event.text || event.text === 'RUNNING' || event.text === 'undefined') return;
        applyTurnStatus(this.shadow, event.text);
        if (isRunFailure(event.text)) this.error = event.text;
        break;
      case 'summary':
        applyTurnSummary(this.shadow, event.phase);
        break;
      default:
        return;
    }
    this.schedule();
  }

  commit(turn: ChatTurn): void {
    this.flush();
    turn.text = this.shadow.text;
    turn.thinking = this.shadow.thinking;
    turn.tools = this.shadow.tools?.map(tool => ({ ...tool }));
    turn.log = this.shadow.log?.map(item => ({ ...item }));
    this.begin();
  }

  private schedule(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.flush();
    });
  }

  private flush(): void {
    this.text = this.shadow.text;
    this.thinking = this.shadow.thinking ?? '';
    const running = [...(this.shadow.tools ?? [])].reverse().find(tool => tool.status === 'running');
    this.toolName = running?.name ?? '';
    const failure = [...(this.shadow.log ?? [])].reverse().find(item => item.kind === 'status' && isRunFailure(item.text));
    this.error = failure && failure.kind === 'status' ? failure.text : '';
    this.frame += 1;
  }

  private cancelFrame(): void {
    if (!this.raf) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

export const chatLive = new ChatLive();
