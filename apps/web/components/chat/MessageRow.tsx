import type { ReactNode } from 'react';
import { CrystalBall, type BallState } from '../CrystalBall';

/* Chat primitives (SPEC §4.F, Paper B8E-0 / BE5-0). Pure presentational. */

/** User bubble, right-aligned: Chambray, radius 20/20/6/20, padding 12×18, max-w 520 (280 mobile). */
export function UserMessage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-end ${className}`}>
      <div className="max-w-[280px] rounded-bubble rounded-br-bubble-tail bg-chambray px-[18px] py-3 text-body-m text-on-chambray sm:max-w-[520px] lg:text-body">
        {children}
      </div>
    </div>
  );
}

/** One Morrow text bubble: surface + hairline, radius 6/20/20/20, padding 12×18, max-w 600. */
export function MorrowBubble({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`max-w-[600px] self-start rounded-bubble rounded-tl-bubble-tail border border-hairline bg-surface px-[18px] py-3 text-body-m text-text lg:text-body ${className}`}
    >
      {children}
    </div>
  );
}

type MorrowProps = {
  /** Mono time next to the name, e.g. `06:43`. */
  time?: string;
  /** Avatar size, 28–32 (default 30). */
  avatarSize?: number;
  /** Avatar motion state. */
  state?: BallState;
  /**
   * Bubbles (`<MorrowBubble>`), a prophecy card, a `<TypingBubble>` — anything. Consecutive
   * bubbles stack under the one avatar (gap 8).
   */
  children: ReactNode;
  className?: string;
};

/** Morrow message: 30px ball avatar + name (Geist 500) + mono time, then its bubbles. */
export function MorrowMessage({ time, avatarSize = 30, state, children, className = '' }: MorrowProps) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <CrystalBall size={avatarSize} variant="avatar" state={state} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex h-[18px] items-baseline gap-2.5">
          <span className="text-[14px] font-medium leading-[18px] text-text">Morrow</span>
          {time && <span className="font-mono text-meta text-text-muted">{time}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Convenience switch: `<MessageRow from="user">…` / `<MessageRow from="morrow" time="06:43">…`. */
export function MessageRow(
  props:
    | ({ from: 'user' } & { children: ReactNode; className?: string })
    | ({ from: 'morrow' } & MorrowProps),
) {
  if (props.from === 'user') return <UserMessage className={props.className}>{props.children}</UserMessage>;
  const { from: _from, ...rest } = props;
  return <MorrowMessage {...rest} />;
}
