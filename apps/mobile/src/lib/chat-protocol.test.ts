import { assistantView, demoScript, lastMessageBody, latestQuota, type MorrowUIMessage } from './chat-protocol';

describe('chat protocol', () => {
  it('sends only the newest message', () => {
    const messages: MorrowUIMessage[] = [
      { id: 'a', role: 'user', parts: [{ type: 'text', text: 'first' }] },
      { id: 'b', role: 'user', parts: [{ type: 'text', text: 'Should I say yes to Sam this time?' }] },
    ];
    expect(lastMessageBody(messages)).toEqual({ message: messages[1] });
  });

  it('collapses re-emitted steps by id and reads observation + quota', () => {
    const msg: MorrowUIMessage = {
      id: 'm',
      role: 'assistant',
      parts: [
        { type: 'data-quota', data: { used: 2, limit: 15 } },
        { type: 'data-step', id: 's1', data: { id: 's1', source: 'calendar', label: 'Calendar', detail: 'x', status: 'active' } },
        { type: 'data-step', id: 's2', data: { id: 's2', source: 'spotify', label: 'Spotify', detail: 'y', status: 'pending' } },
        { type: 'data-step', id: 's1', data: { id: 's1', source: 'calendar', label: 'Calendar', detail: 'x', status: 'done' } },
        { type: 'text', text: 'Yes.' },
        { type: 'data-observation', data: { text: 'Yes.', evidenceRef: 'r', sourceLabel: 'Calendar' } },
      ],
    };
    const view = assistantView(msg);
    expect(view.steps.map((s) => `${s.id}:${s.status}`)).toEqual(['s1:done', 's2:pending']);
    expect(view.observation?.sourceLabel).toBe('Calendar');
    expect(view.texts).toEqual(['Yes.']);
    expect(latestQuota([msg])).toEqual({ used: 2, limit: 15 });
  });

  it('scripts the demo stream per §10: quota first, steps, text, finish', () => {
    const script = demoScript(3).map((s) => s.chunk);
    expect(script[0]?.type).toBe('start');
    expect(script[1]).toEqual({ type: 'data-quota', data: { used: 3, limit: 15 } });
    const stepIds = new Set(script.flatMap((c) => (c.type === 'data-step' ? [c.data.id] : [])));
    expect(stepIds).toEqual(new Set(['s_calendar', 's_spotify', 's_memory']));
    const text = script.flatMap((c) => (c.type === 'text-delta' ? [c.delta] : [])).join('');
    expect(text).toContain('Thursday morning is open');
    expect(script[script.length - 1]?.type).toBe('finish');
  });
});
