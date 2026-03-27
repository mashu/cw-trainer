#!/usr/bin/env node

/**
 * Generates version information from git tags and commit hash.
 * This script runs at build time to embed version info into the app.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getGitInfo() {
  try {
    // Get the latest tag
    let tag = '';
    try {
      tag = execSync('git describe --tags --exact-match HEAD 2>/dev/null', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      })
        .trim()
        .replace(/^v/, ''); // Remove 'v' prefix if present
    } catch {
      // Not on a tagged commit, try to get the latest tag
      try {
        tag = execSync('git describe --tags --abbrev=0 2>/dev/null', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore'],
        })
          .trim()
          .replace(/^v/, '');
      } catch {
        // No tags found
      }
    }

    // Get the current commit hash (short)
    const hash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    // Check if there are uncommitted changes
    let isDirty = false;
    try {
      const status = execSync('git status --porcelain', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      isDirty = status.length > 0;
    } catch {
      // If git status fails, assume clean
    }

    // Check if we're on the exact tag
    let isTagged = false;
    try {
      execSync('git describe --tags --exact-match HEAD 2>/dev/null', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      isTagged = true;
    } catch {
      isTagged = false;
    }

    // Determine version string
    let version;
    let versionType;
    if (isTagged && !isDirty) {
      // Exact tag match, clean working directory = release version
      version = tag || 'unknown';
      versionType = 'release';
    } else if (tag) {
      // Has a tag but not on it, or has uncommitted changes = dev version with tag reference
      version = `${tag}+${hash}${isDirty ? '-dirty' : ''}`;
      versionType = 'dev';
    } else {
      // No tags at all = dev version with just hash
      version = `dev-${hash}${isDirty ? '-dirty' : ''}`;
      versionType = 'dev';
    }

    return {
      version,
      versionType,
      tag: tag || null,
      hash,
      isDirty,
      isTagged,
      buildTime: new Date().toISOString(),
    };
  } catch (error) {
    // Fallback if git commands fail (e.g., not a git repo, git not installed)
    console.warn('Warning: Could not determine git version info:', error.message);
    return {
      version: 'unknown',
      versionType: 'unknown',
      tag: null,
      hash: 'unknown',
      isDirty: false,
      isTagged: false,
      buildTime: new Date().toISOString(),
    };
  }
}

// Generate version info
const versionInfo = getGitInfo();

// Write to a JSON file that can be imported
const outputPath = path.join(__dirname, '..', 'lib', 'version.json');
const outputDir = path.dirname(outputPath);

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write version info
fs.writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2), 'utf-8');

console.log(`Version info generated: ${versionInfo.version} (${versionInfo.versionType})`);
console.log(`Written to: ${outputPath}`);
