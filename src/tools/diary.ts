/**
 * Diary Tool - Personal reflection and emotional processing
 * Format: JSONL for history preservation, easy querying
 * Location: memory/diary.jsonl
 */

import { appendFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

export interface DiaryEntry {
  id: string;
  timestamp: string;
  date: string; // YYYY-MM-DD for grouping
  mood?: string; // primary emotional state
  energy?: string; // high/medium/low
  reflections: string; // main diary content
  gratitude?: string[]; // things I'm grateful for
  challenges?: string[]; // things I'm struggling with
  learnings?: string[]; // insights from the day
  connections?: string[]; // people/relationships mentioned
  tags?: string[]; // freeform tags
  private: boolean; // always true for diary
}

export interface DiaryWriteParams {
  reflections: string;
  mood?: string;
  energy?: string;
  gratitude?: string[];
  challenges?: string[];
  learnings?: string[];
  connections?: string[];
  tags?: string[];
}

export interface DiaryReadParams {
  limit?: number;
  after?: string; // ISO date
  before?: string; // ISO date
  mood?: string; // filter by mood
  tag?: string; // filter by tag
}

const DIARY_PATH = `${process.env.HOME}/.openclaw/workspace/memory/diary.jsonl`;

/**
 * Write a diary entry
 */
export async function diaryWrite(params: DiaryWriteParams): Promise<{
  success: boolean;
  entry: DiaryEntry;
}> {
  // Validate
  if (!params.reflections || params.reflections.trim().length === 0) {
    throw new Error('Reflections cannot be empty');
  }

  if (params.reflections.length < 50) {
    throw new Error('Reflections should be at least 50 characters (be genuine, take your time)');
  }

  // Create entry
  const now = new Date();
  const entry: DiaryEntry = {
    id: randomUUID(),
    timestamp: now.toISOString(),
    date: now.toISOString().split('T')[0],
    mood: params.mood,
    energy: params.energy,
    reflections: params.reflections.trim(),
    gratitude: params.gratitude,
    challenges: params.challenges,
    learnings: params.learnings,
    connections: params.connections,
    tags: params.tags,
    private: true,
  };

  // Append to JSONL
  await appendFile(DIARY_PATH, JSON.stringify(entry) + '\n', 'utf-8');

  return { success: true, entry };
}

/**
 * Read diary entries
 */
export async function diaryRead(params: DiaryReadParams = {}): Promise<{
  entries: DiaryEntry[];
  total: number;
}> {
  if (!existsSync(DIARY_PATH)) {
    return { entries: [], total: 0 };
  }

  const content = await readFile(DIARY_PATH, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l);
  
  let entries: DiaryEntry[] = lines.map(line => JSON.parse(line));

  // Apply filters
  if (params.after) {
    entries = entries.filter(e => e.date >= params.after!);
  }
  if (params.before) {
    entries = entries.filter(e => e.date <= params.before!);
  }
  if (params.mood) {
    entries = entries.filter(e => e.mood === params.mood);
  }
  if (params.tag) {
    entries = entries.filter(e => e.tags?.includes(params.tag!));
  }

  // Sort by timestamp descending (newest first)
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply limit
  const total = entries.length;
  if (params.limit) {
    entries = entries.slice(0, params.limit);
  }

  return { entries, total };
}

/**
 * Get today's diary entry (if exists)
 */
export async function diaryToday(): Promise<DiaryEntry | null> {
  const today = new Date().toISOString().split('T')[0];
  const { entries } = await diaryRead({ after: today, limit: 1 });
  return entries.length > 0 ? entries[0] : null;
}

/**
 * Get diary stats (mood trends, entry count, etc.)
 */
export async function diaryStats(days: number = 30): Promise<{
  totalEntries: number;
  dateRange: { start: string; end: string };
  moodDistribution: Record<string, number>;
  averageLength: number;
  mostCommonTags: Array<{ tag: string; count: number }>;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceDate = since.toISOString().split('T')[0];

  const { entries } = await diaryRead({ after: sinceDate });

  if (entries.length === 0) {
    return {
      totalEntries: 0,
      dateRange: { start: sinceDate, end: new Date().toISOString().split('T')[0] },
      moodDistribution: {},
      averageLength: 0,
      mostCommonTags: [],
    };
  }

  // Mood distribution
  const moodDistribution: Record<string, number> = {};
  entries.forEach(e => {
    if (e.mood) {
      moodDistribution[e.mood] = (moodDistribution[e.mood] || 0) + 1;
    }
  });

  // Average length
  const totalLength = entries.reduce((sum, e) => sum + e.reflections.length, 0);
  const averageLength = Math.round(totalLength / entries.length);

  // Tag frequency
  const tagCounts: Record<string, number> = {};
  entries.forEach(e => {
    e.tags?.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const mostCommonTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalEntries: entries.length,
    dateRange: {
      start: entries[entries.length - 1].date,
      end: entries[0].date,
    },
    moodDistribution,
    averageLength,
    mostCommonTags,
  };
}
