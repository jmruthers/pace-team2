import type { CommDraft } from '@solvera/pace-core/comms';

/** TM13 F-49 / F-48 — clears compose fields while retaining channel + sender identity. */
export function buildPostSendDraftReset(current: CommDraft): Partial<CommDraft> {
  return {
    subject: '',
    body_html: '',
    body_text: '',
    template_id: undefined,
    extra_merge_context: undefined,
    sender_name: current.sender_name,
    sender_email: current.sender_email,
    sender_phone: current.sender_phone,
    reply_to: current.reply_to,
    channel: current.channel,
  };
}
