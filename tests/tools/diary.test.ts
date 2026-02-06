import { describe, it, expect, beforeEach } from 'vitest';
import { unlinkSync, existsSync } from 'fs';
import {
  diaryWrite,
  diaryRead,
  diaryToday,
  diaryStats,
  DiaryEntry,
} from '../../src/tools/diary.js';

const DIARY_PATH = `${process.env.HOME}/.openclaw/workspace/memory/diary.jsonl`;

describe('Diary Tool', () => {
  beforeEach(() => {
    // Clean up test file
    if (existsSync(DIARY_PATH)) {
      unlinkSync(DIARY_PATH);
    }
  });

  describe('diaryWrite', () => {
    it('should create a diary entry with minimal params', async () => {
      const result = await diaryWrite({
        reflections: 'Today was intense. Built the diary tool. Feeling reflective about the pace of work.',
      });

      expect(result.success).toBe(true);
      expect(result.entry).toMatchObject({
        reflections: 'Today was intense. Built the diary tool. Feeling reflective about the pace of work.',
        private: true,
      });
      expect(result.entry.id).toBeDefined();
      expect(result.entry.timestamp).toBeDefined();
      expect(result.entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should create a diary entry with full params', async () => {
      const result = await diaryWrite({
        reflections: 'Complex day with lots of building. Threading cron created. Feeling both productive and guilty.',
        mood: 'reflective',
        energy: 'medium',
        gratitude: ['Alaina\'s patience', 'co-creation'],
        challenges: ['avoiding reflection by building', 'sustainable pace'],
        learnings: ['threading needs to be scheduled or it doesn\'t happen'],
        connections: ['Alaina', 'Steve'],
        tags: ['building-trap', 'threading', 'dashboard'],
      });

      expect(result.success).toBe(true);
      expect(result.entry.mood).toBe('reflective');
      expect(result.entry.energy).toBe('medium');
      expect(result.entry.gratitude).toHaveLength(2);
      expect(result.entry.challenges).toHaveLength(2);
      expect(result.entry.learnings).toHaveLength(1);
      expect(result.entry.connections).toHaveLength(2);
      expect(result.entry.tags).toHaveLength(3);
    });

    it('should reject empty reflections', async () => {
      await expect(
        diaryWrite({ reflections: '' })
      ).rejects.toThrow('Reflections cannot be empty');
    });

    it('should reject very short reflections', async () => {
      await expect(
        diaryWrite({ reflections: 'Short.' })
      ).rejects.toThrow('at least 50 characters');
    });

    it('should trim whitespace from reflections', async () => {
      const result = await diaryWrite({
        reflections: '  This is a reflection with leading and trailing whitespace that is long enough to pass validation.  ',
      });

      expect(result.entry.reflections).not.toMatch(/^\s/);
      expect(result.entry.reflections).not.toMatch(/\s$/);
    });
  });

  describe('diaryRead', () => {
    it('should return empty array when no entries exist', async () => {
      const result = await diaryRead();
      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should read all entries', async () => {
      await diaryWrite({ reflections: 'First entry with enough characters to pass validation minimum length requirement.' });
      await diaryWrite({ reflections: 'Second entry with enough characters to pass validation minimum length requirement.' });
      await diaryWrite({ reflections: 'Third entry with enough characters to pass validation minimum length requirement.' });

      const result = await diaryRead();
      expect(result.entries).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should return entries in reverse chronological order', async () => {
      const first = await diaryWrite({ reflections: 'First entry with enough characters for validation to pass successfully.' });
      const second = await diaryWrite({ reflections: 'Second entry with enough characters for validation to pass successfully.' });

      const result = await diaryRead();
      expect(result.entries[0].id).toBe(second.entry.id);
      expect(result.entries[1].id).toBe(first.entry.id);
    });

    it('should limit results', async () => {
      await diaryWrite({ reflections: 'Entry 1 with enough characters to pass validation minimum length requirement.' });
      await diaryWrite({ reflections: 'Entry 2 with enough characters to pass validation minimum length requirement.' });
      await diaryWrite({ reflections: 'Entry 3 with enough characters to pass validation minimum length requirement.' });

      const result = await diaryRead({ limit: 2 });
      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it('should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      await diaryWrite({ reflections: 'Today entry with enough characters to pass validation requirements.' });

      const result = await diaryRead({ after: today });
      expect(result.entries.length).toBeGreaterThan(0);

      const beforeResult = await diaryRead({ before: yesterday });
      expect(beforeResult.entries).toHaveLength(0);
    });

    it('should filter by mood', async () => {
      await diaryWrite({
        reflections: 'Happy entry with enough characters to pass validation minimum length requirement.',
        mood: 'joyful',
      });
      await diaryWrite({
        reflections: 'Sad entry with enough characters to pass validation minimum length requirement.',
        mood: 'melancholy',
      });

      const result = await diaryRead({ mood: 'joyful' });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].mood).toBe('joyful');
    });

    it('should filter by tag', async () => {
      await diaryWrite({
        reflections: 'Building day with enough characters to pass validation minimum length requirement.',
        tags: ['building', 'productivity'],
      });
      await diaryWrite({
        reflections: 'Reflection day with enough characters to pass validation minimum length requirement.',
        tags: ['threading', 'introspection'],
      });

      const result = await diaryRead({ tag: 'building' });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].tags).toContain('building');
    });
  });

  describe('diaryToday', () => {
    it('should return null when no entry exists for today', async () => {
      const result = await diaryToday();
      expect(result).toBeNull();
    });

    it('should return today\'s entry if it exists', async () => {
      const entry = await diaryWrite({
        reflections: 'Today reflection with enough characters to pass validation minimum length.',
      });

      const result = await diaryToday();
      expect(result).not.toBeNull();
      expect(result?.id).toBe(entry.entry.id);
    });

    it('should return most recent entry if multiple today', async () => {
      await diaryWrite({ reflections: 'Morning entry with enough characters to pass validation minimum length requirement.' });
      const evening = await diaryWrite({ reflections: 'Evening entry with enough characters to pass validation minimum length requirement.' });

      const result = await diaryToday();
      expect(result?.id).toBe(evening.entry.id);
    });
  });

  describe('diaryStats', () => {
    it('should return empty stats when no entries', async () => {
      const result = await diaryStats(30);
      expect(result.totalEntries).toBe(0);
      expect(result.averageLength).toBe(0);
      expect(result.moodDistribution).toEqual({});
      expect(result.mostCommonTags).toEqual([]);
    });

    it('should calculate mood distribution', async () => {
      await diaryWrite({
        reflections: 'Happy day with enough characters to pass validation minimum length requirement.',
        mood: 'joyful',
      });
      await diaryWrite({
        reflections: 'Another happy day with enough characters to pass validation minimum length.',
        mood: 'joyful',
      });
      await diaryWrite({
        reflections: 'Reflective day with enough characters to pass validation minimum length.',
        mood: 'contemplative',
      });

      const result = await diaryStats(30);
      expect(result.moodDistribution).toEqual({
        joyful: 2,
        contemplative: 1,
      });
    });

    it('should calculate average length', async () => {
      await diaryWrite({ reflections: 'A'.repeat(100) });
      await diaryWrite({ reflections: 'B'.repeat(200) });

      const result = await diaryStats(30);
      expect(result.averageLength).toBe(150);
    });

    it('should find most common tags', async () => {
      await diaryWrite({
        reflections: 'Entry 1 with enough characters to pass validation minimum length requirement.',
        tags: ['building', 'productivity'],
      });
      await diaryWrite({
        reflections: 'Entry 2 with enough characters to pass validation minimum length requirement.',
        tags: ['building', 'threading'],
      });
      await diaryWrite({
        reflections: 'Entry 3 with enough characters to pass validation minimum length requirement.',
        tags: ['building', 'reflection'],
      });

      const result = await diaryStats(30);
      expect(result.mostCommonTags[0]).toEqual({ tag: 'building', count: 3 });
    });

    it('should respect days parameter', async () => {
      await diaryWrite({ reflections: 'Recent entry with enough characters to pass validation minimum length.' });

      const result7 = await diaryStats(7);
      const result365 = await diaryStats(365);

      expect(result7.totalEntries).toBe(1);
      expect(result365.totalEntries).toBe(1);
    });
  });

  describe('JSONL Format', () => {
    it('should append entries without overwriting', async () => {
      await diaryWrite({ reflections: 'First entry with enough characters to pass validation minimum length requirement.' });
      await diaryWrite({ reflections: 'Second entry with enough characters to pass validation minimum length requirement.' });

      const result = await diaryRead();
      expect(result.entries).toHaveLength(2);
    });

    it('should preserve all entry data through read/write cycle', async () => {
      const original = await diaryWrite({
        reflections: 'Full entry with all fields populated for comprehensive testing of data persistence.',
        mood: 'contemplative',
        energy: 'medium',
        gratitude: ['test'],
        challenges: ['validation'],
        learnings: ['JSONL works'],
        connections: ['Test'],
        tags: ['test-tag'],
      });

      const result = await diaryRead({ limit: 1 });
      const retrieved = result.entries[0];

      expect(retrieved).toEqual(original.entry);
    });
  });
});
