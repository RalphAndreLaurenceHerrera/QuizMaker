const STORAGE_KEY = 'GIZMO_ADAPTIVE_DECK_V1';
let audioMuted = false;

const DEFAULT_DECK = [
  {
    id: 'c1',
    type: 'single',
    question: 'Which HTTP status code signifies a resource was successfully created on the server?',
    options: ['200 OK', '201 Created', '204 No Content', '301 Moved Permanently'],
    correct: ['201 Created'],
    box: 1,
    explanation: 'HTTP 201 Created is the standard RESTful status response indicating that one or more new resources have been successfully generated.'
  },
  {
    id: 'c2',
    type: 'multiple',
    question: 'Which of the following are primitive data types in JavaScript?',
    options: ['String', 'Symbol', 'Array', 'BigInt'],
    correct: ['String', 'Symbol', 'BigInt'],
    box: 1,
    explanation: 'Arrays and Objects are structural reference types; String, Symbol, and BigInt are primitive data types.'
  }
];

let questionPool = [];
let currentSession = {
  queue: [],
  currentIndex: 0,
  selectedOptions: [],
  correctCount: 0,
  missedCount: 0,
  isAnswerChecked: false
};

/**
 * Picks a subset of items weighted by Leitner tier:
 * Box 1: 4.0x
 * Box 2: 2.0x
 * Box 3+: 1.0x
 */
function generateAdaptiveQueue(targetSize) {
  if (!questionPool.length) return [];
  const getWeight = (b) => (b <= 1 ? 4.0 : b === 2 ? 2.0 : 1.0);

  const poolCopy = [...questionPool];
  const selected = [];
  const sessionCount = Math.min(targetSize, poolCopy.length);

  for (let i = 0; i < sessionCount; i++) {
    const totalWeight = poolCopy.reduce((sum, item) => sum + getWeight(item.box || 1), 0);
    const randomVal = Math.random() * totalWeight;
    let cumulative = 0;
    let chosenIndex = 0;

    for (let j = 0; j < poolCopy.length; j++) {
      cumulative += getWeight(poolCopy[j].box || 1);
      if (randomVal <= cumulative) {
        chosenIndex = j;
        break;
      }
    }

    selected.push(poolCopy[chosenIndex]);
    poolCopy.splice(chosenIndex, 1);
  }

  return selected;
}

function exportCSV() {
  const headers = ['type', 'question', 'options', 'correct', 'box', 'explanation'];
  const rows = questionPool.map(q => {
    const esc = (str) => `"${(str || '').replace(/"/g, '""')}"`;
    return [
      q.type || 'single',
      esc(q.question),
      esc(q.options.join('|')),
      esc(q.correct.join('|')),
      q.box || 1,
      esc(q.explanation || '')
    ].join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

function parseCSVString(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const cards = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length >= 4) {
      cards.push({
        id: 'c_' + Math.random().toString(36).substr(2, 9),
        type: (cols[0] || 'single').toLowerCase().includes('multi') ? 'multiple' : 'single',
        question: cols[1],
        options: (cols[2] || '').split('|').map(s => s.trim()).filter(Boolean),
        correct: (cols[3] || '').split('|').map(s => s.trim()).filter(Boolean),
        box: parseInt(cols[4], 10) || 1,
        explanation: cols[5] || ''
      });
    }
  }
  return cards;
}