import { messages } from '../lib/messages';

export function PrivacyNotice() {
  return (
    <aside className="privacy" role="note">
      <svg className="privacy__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3zm-1 13-3-3 1.4-1.4L11 12.2l4.6-4.6L17 9l-6 6z"
          fill="currentColor"
        />
      </svg>
      <p className="privacy__text">{messages.privacy}</p>
    </aside>
  );
}
