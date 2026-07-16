import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TalkBalancerTranscriptFeed } from '@/components/talkbalancer/TalkBalancerTranscriptFeed';
import type { TbTranscriptNote, TbTranscriptionStatus } from '@/lib/talkbalancer';

const notes: TbTranscriptNote[] = [{
  id: 'note-1',
  sessionId: 'session-1',
  timestamp: '2026-07-17T01:23:45Z',
  text: '新宿駅の近くで二次会を予約します',
  participantId: 'speaker-1',
  participantName: 'Aさん',
  source: 'auto',
}];

const status: TbTranscriptionStatus = {
  active: true,
  state: 'listening',
  sourceId: 'source-1',
  engineAvailable: true,
  engine: 'faster-whisper',
  model: 'small',
  speakerEngine: 'acoustic',
  currentSpeakerKey: 'voice-1',
  currentParticipantId: 'speaker-1',
  currentSpeakerName: 'Aさん',
  currentSpeakerConfidence: 0.8,
  latestText: notes[0].text,
  updatedAt: notes[0].timestamp,
  audioRetention: 'memory-only',
  cloudUpload: false,
  clusters: [],
};

describe('TalkBalancerTranscriptFeed', () => {
  test('keeps the running status visible while transcript text is hidden', () => {
    render(<TalkBalancerTranscriptFeed notes={notes} status={status} live />);

    expect(screen.getByText('文字起こし稼働中')).toBeVisible();
    expect(screen.getAllByText(notes[0].text)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /文字起こし稼働中/ }));

    expect(screen.getByText('文字起こし稼働中')).toBeVisible();
    expect(screen.queryByText(notes[0].text)).not.toBeInTheDocument();
    expect(screen.getByText(/1件/)).toBeVisible();
  });

  test('starts collapsed in compact organizer controls', () => {
    render(<TalkBalancerTranscriptFeed notes={notes} status={status} live compact />);

    expect(screen.getByText('文字起こし稼働中')).toBeVisible();
    expect(screen.queryByText(notes[0].text)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /文字起こし稼働中/ })).toHaveAttribute('aria-expanded', 'false');
  });
});
