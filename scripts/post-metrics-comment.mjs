#!/usr/bin/env node
/**
 * Post metrics comment to PR
 * Reads metrics files and posts a summary comment to the PR
 */

import { readFileSync, existsSync } from 'fs';
import { Octokit } from '@octokit/rest';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

const COMPLEXITY_FILE = 'metrics/complexity.json';
const COVERAGE_FILE = 'metrics/coverage.json';
const TYPE_COVERAGE_FILE = 'metrics/type-coverage.json';

const THRESHOLDS = {
  complexity: 10,
  coverage: 90,
  typeCoverage: 95,
};

const BOT_LOGIN = 'github-actions[bot]';

if (!GITHUB_TOKEN || !PR_NUMBER || !REPO_OWNER || !REPO_NAME) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

function readComplexity() {
  if (!existsSync(COMPLEXITY_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(COMPLEXITY_FILE, 'utf8'));
    const functions = [];
    let totalComplexity = 0;
    let count = 0;

    for (const file of raw) {
      for (const msg of file.messages) {
        if (msg.ruleId !== 'complexity') continue;
        const match = msg.message.match(/complexity of (\d+)/);
        if (!match) continue;

        const complexity = parseInt(match[1], 10);
        functions.push({
          file: file.filePath,
          line: msg.line,
          complexity,
        });
        totalComplexity += complexity;
        count++;
      }
    }

    const overThreshold = functions.filter((f) => f.complexity >= THRESHOLDS.complexity);
    return {
      functions,
      maxComplexity: functions.length > 0 ? Math.max(...functions.map((f) => f.complexity)) : 0,
      avgComplexity: count > 0 ? (totalComplexity / count).toFixed(2) : 0,
      overThreshold: overThreshold.length,
      overThresholdFunctions: overThreshold,
    };
  } catch (e) {
    console.error('Error reading complexity:', e.message);
    return null;
  }
}

function readCoverage() {
  if (!existsSync(COVERAGE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(COVERAGE_FILE, 'utf8'));
    return {
      lines: raw.totals?.lines?.pct?.toFixed(2) ?? '0',
      branches: raw.totals?.branches?.pct?.toFixed(2) ?? '0',
      functions: raw.totals?.functions?.pct?.toFixed(2) ?? '0',
      statements: raw.totals?.statements?.pct?.toFixed(2) ?? '0',
    };
  } catch (e) {
    console.error('Error reading coverage:', e.message);
    return null;
  }
}

function readTypeCoverage() {
  if (!existsSync(TYPE_COVERAGE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(TYPE_COVERAGE_FILE, 'utf8'));
    return {
      percent: raw.percentString ?? raw.percent ?? 0,
      correctCount: raw.correctCount ?? 0,
      totalCount: raw.totalCount ?? 0,
    };
  } catch (e) {
    console.error('Error reading type coverage:', e.message);
    return null;
  }
}

function formatComplexity(complexity) {
  if (!complexity) return 'No data';

  const status = complexity.maxComplexity >= THRESHOLDS.complexity ? '⚠️' : '✅';
  let body = `${status} **Max**: ${complexity.maxComplexity} (threshold: < ${THRESHOLDS.complexity})\n`;
  body += `**Average**: ${complexity.avgComplexity}\n`;
  body += `**Over threshold (≥${THRESHOLDS.complexity})**: ${complexity.overThreshold}\n`;

  if (complexity.overThresholdFunctions.length > 0) {
    body += '\n**Functions exceeding threshold**:\n';
    for (const fn of complexity.overThresholdFunctions.slice(0, 10)) {
      body += `- \`${fn.file}:${fn.line}\` - complexity ${fn.complexity}\n`;
    }
    if (complexity.overThresholdFunctions.length > 10) {
      body += `... and ${complexity.overThresholdFunctions.length - 10} more\n`;
    }
  }
  return body;
}

function formatCoverage(coverage) {
  if (!coverage) return 'No data';

  const threshold = THRESHOLDS.coverage;
  let body = '';
  for (const [key, value] of Object.entries(coverage)) {
    const status = Number(value) >= threshold ? '✅' : '⚠️';
    body += `${status} **${key.charAt(0).toUpperCase() + key.slice(1)}**: ${value}% (threshold: > ${threshold}%)\n`;
  }
  return body;
}

function formatTypeCoverage(typeCoverage) {
  if (!typeCoverage) return 'No data';

  const threshold = THRESHOLDS.typeCoverage;
  const status = typeCoverage.percent >= threshold ? '✅' : '⚠️';
  let body = `${status} **Coverage**: ${typeCoverage.percent}% (threshold: > ${threshold}%)\n`;
  body += `**Typed symbols**: ${typeCoverage.correctCount} / ${typeCoverage.totalCount}\n`;
  return body;
}

async function findExistingBotComment() {
  const { data: comments } = await octokit.issues.listComments({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: PR_NUMBER,
  });

  return comments.find(
    (c) => c.user.login === BOT_LOGIN && c.body.includes('Metrics Dashboard')
  );
}

async function postComment() {
  const complexity = readComplexity();
  const coverage = readCoverage();
  const typeCoverage = readTypeCoverage();

  const commentBody = `
## 📊 Metrics Dashboard

### Cyclomatic Complexity (ESLint)
${formatComplexity(complexity)}

### Code Coverage (c8)
${formatCoverage(coverage)}

### Type Coverage (type-coverage)
${formatTypeCoverage(typeCoverage)}

---
*Soft gates: Metrics are reported but do not block merges.*
*Thresholds: Complexity < ${THRESHOLDS.complexity}, Coverage > ${THRESHOLDS.coverage}%, Type Coverage > ${THRESHOLDS.typeCoverage}%*
  `.trim();

  const botComment = await findExistingBotComment();

  try {
    if (botComment) {
      await octokit.issues.updateComment({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        comment_id: botComment.id,
        body: commentBody,
      });
      console.log('Updated existing metrics comment');
    } else {
      await octokit.issues.createComment({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        issue_number: PR_NUMBER,
        body: commentBody,
      });
      console.log('Created new metrics comment');
    }
  } catch (error) {
    console.error('Error posting comment:', error.message);
    process.exit(1);
  }
}

postComment();