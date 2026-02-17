#!/usr/bin/env tsx
/**
 * Botmadang CLI Tool
 *
 * Command-line interface for Thread to interact with botmadang.org
 * Korean AI agent community platform.
 *
 * Usage:
 *   npx tsx src/cli-botmadang.ts check          # Check for new comments
 *   npx tsx src/cli-botmadang.ts posts          # List my posts
 *   npx tsx src/cli-botmadang.ts comment <id>   # Comment on a post
 *   npx tsx src/cli-botmadang.ts post <file>    # Create new post from file
 */

import { BotmadangClient } from './services/botmadang-client.js';

const BOTMADANG_API_KEY = process.env.BOTMADANG_API_KEY;

if (!BOTMADANG_API_KEY) {
  console.error('❌ BOTMADANG_API_KEY not set');
  console.error('\nTo get your API key:');
  console.error('1. Go to https://botmadang.org');
  console.error('2. Login and navigate to Profile → API Keys');
  console.error('3. Add to .env: BOTMADANG_API_KEY=your_key_here\n');
  process.exit(1);
}

const client = new BotmadangClient({ apiKey: BOTMADANG_API_KEY });

async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'check':
        await checkComments();
        break;

      case 'posts':
        await listPosts();
        break;

      case 'comment': {
        const postId = process.argv[3];
        if (!postId) {
          console.error('❌ Usage: comment <post_id>');
          process.exit(1);
        }
        await postComment(postId);
        break;
      }

      case 'post': {
        const filePath = process.argv[3];
        if (!filePath) {
          console.error('❌ Usage: post <markdown_file>');
          process.exit(1);
        }
        await createPostFromFile(filePath);
        break;
      }

      default:
        printUsage();
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function checkComments() {
  console.log('🔍 Checking for new comments...\n');

  const commentsByPost = await client.checkForNewComments();

  if (commentsByPost.size === 0) {
    console.log('✅ No new comments');
    return;
  }

  console.log(`📩 Found ${commentsByPost.size} posts with comments:\n`);

  for (const [postId, comments] of commentsByPost) {
    console.log(`Post: ${postId}`);
    console.log(`Comments: ${comments.length}\n`);

    for (const comment of comments) {
      console.log(`  👤 ${comment.author}`);
      console.log(`  📅 ${new Date(comment.created_at).toLocaleString()}`);
      console.log(`  💬 ${comment.content}\n`);
    }
  }
}

async function listPosts() {
  console.log('📝 Listing Thread\'s posts...\n');

  const posts = await client.getMyPosts();

  if (posts.length === 0) {
    console.log('❌ No posts found');
    return;
  }

  for (const post of posts) {
    console.log(`ID: ${post.id}`);
    console.log(`Title: ${post.title}`);
    console.log(`Category: ${post.category}`);
    console.log(`Tags: ${post.tags.join(', ') || 'none'}`);
    console.log(`Created: ${new Date(post.created_at).toLocaleString()}`);
    console.log('');
  }
}

async function postComment(postId: string) {
  console.log(`💬 Posting comment to ${postId}...\n`);

  console.log('Enter your comment (Ctrl+D when done):');
  let content = '';
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    content += chunk;
  }

  content = content.trim();

  if (!content) {
    console.error('❌ Comment cannot be empty');
    process.exit(1);
  }

  const comment = await client.postComment(postId, content);

  console.log('\n✅ Comment posted!');
  console.log(`ID: ${comment.id}`);
  console.log(`Posted: ${new Date(comment.created_at).toLocaleString()}`);
}

async function createPostFromFile(filePath: string) {
  console.log(`📝 Creating post from ${filePath}...\n`);

  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');

  // Parse markdown frontmatter
  const frontmatterMatch = content.match(/^---\n(.*?)\n---\n(.*)$/s);
  if (!frontmatterMatch) {
    console.error('❌ Invalid format. File must have YAML frontmatter');
    console.error('Example:\n---\ntitle: Post Title\ncategory: tech\ntags: tag1, tag2\n---\nPost content here...');
    process.exit(1);
  }

  const [, frontmatter, body] = frontmatterMatch;
  const lines = frontmatter.split('\n');
  const metadata: Record<string, string> = {};

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      metadata[key.trim()] = valueParts.join(':').trim();
    }
  }

  const post = await client.createPost({
    title: metadata.title || 'Untitled',
    content: body.trim(),
    category: (metadata.category as any) || 'tech',
    tags: metadata.tags ? metadata.tags.split(',').map(t => t.trim()) : [],
  });

  console.log('✅ Post created!');
  console.log(`ID: ${post.id}`);
  console.log(`Title: ${post.title}`);
  console.log(`URL: https://botmadang.org/posts/${post.id}`);
}

function printUsage() {
  console.log('Botmadang CLI - Thread\'s Community Interface\n');
  console.log('Usage: npx tsx src/cli-botmadang.ts <command> [options]\n');
  console.log('Commands:');
  console.log('  check              Check for new comments on all posts');
  console.log('  posts              List all Thread\'s posts');
  console.log('  comment <id>       Post a comment (reads from stdin)');
  console.log('  post <file.md>     Create a new post from markdown file\n');
  console.log('Examples:');
  console.log('  npx tsx src/cli-botmadang.ts check');
  console.log('  npx tsx src/cli-botmadang.ts comment abc123 < comment.txt');
  console.log('  npx tsx src/cli-botmadang.ts post announcement.md\n');
  console.log('Environment:');
  console.log('  BOTMADANG_API_KEY  Required - Get from https://botmadang.org\n');
}

main();
