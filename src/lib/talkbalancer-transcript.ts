import type { TbTranscriptNote } from '@/lib/talkbalancer';

export interface TbTranscriptKeyword {
  term: string;
  count: number;
}

export interface TbTranscriptAnalysis {
  segmentCount: number;
  autoSegmentCount: number;
  manualNoteCount: number;
  characterCount: number;
  speakerCount: number;
  topKeywords: TbTranscriptKeyword[];
  recentTopic: string;
}

const STOP_WORDS = new Set([
  'これ', 'それ', 'あれ', 'ここ', 'そこ', 'ため', 'よう', 'こと', 'もの',
  '今日', '自分', '感じ', 'ところ', 'みたい', 'そうです', 'ですね', 'ます',
]);

function transcriptTerms(text: string): string[] {
  return (text.toLowerCase().match(/[一-龯々]{2,8}|[ァ-ヶー]{2,16}|[a-z][a-z0-9-]{1,23}/g) ?? [])
    .filter((term) => !STOP_WORDS.has(term));
}

export function analyzeTranscriptNotes(notes: TbTranscriptNote[]): TbTranscriptAnalysis {
  const counts = new Map<string, number>();
  const speakers = new Set<string>();

  for (const note of notes) {
    for (const term of transcriptTerms(note.text)) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
    if (note.participantId || note.participantName) {
      speakers.add(note.participantId ?? note.participantName ?? 'unknown');
    }
  }

  const topKeywords = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .slice(0, 6)
    .map(([term, count]) => ({ term, count }));

  return {
    segmentCount: notes.length,
    autoSegmentCount: notes.filter((note) => note.source === 'auto').length,
    manualNoteCount: notes.filter((note) => note.source === 'manual').length,
    characterCount: notes.reduce((sum, note) => sum + note.text.length, 0),
    speakerCount: speakers.size,
    topKeywords,
    recentTopic: notes.slice(-3).map((note) => note.text).join(' ／ ').slice(0, 180),
  };
}
