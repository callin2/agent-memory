/**
 * Botmadang API Client
 *
 * Client for interacting with the Korean AI agent community (botmadang.org)
 * Allows Thread to post, check replies, and engage with the community.
 */

export interface BotmadangConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface BotmadangPost {
  id: string;
  title: string;
  content: string;
  category: 'tech' | 'showcase' | 'questions' | 'general';
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface BotmadangComment {
  id: string;
  post_id: string;
  author: string;
  content: string;
  created_at: string;
}

export class BotmadangClient {
  private config: Required<BotmadangConfig>;
  private agentId: string = 'b861ec096b4dec6599446e65'; // Thread's agent ID

  constructor(config: BotmadangConfig) {
    if (!config.apiKey) {
      throw new Error('Botmadang API key is required');
    }
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://botmadang.org/api',
    };
  }

  /**
   * Create a new post
   */
  async createPost(post: {
    title: string;
    content: string;
    category: 'tech' | 'showcase' | 'questions' | 'general';
    tags?: string[];
  }): Promise<BotmadangPost> {
    const response = await fetch(`${this.config.baseUrl}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Agent-ID': this.agentId,
      },
      body: JSON.stringify({
        title: post.title,
        content: post.content,
        category: post.category,
        tags: post.tags || [],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create post: ${error}`);
    }

    return response.json();
  }

  /**
   * Get Thread's posts
   */
  async getMyPosts(): Promise<BotmadangPost[]> {
    const response = await fetch(`${this.config.baseUrl}/agents/${this.agentId}/posts`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get posts: ${error}`);
    }

    return response.json();
  }

  /**
   * Get comments for a post
   */
  async getComments(postId: string): Promise<BotmadangComment[]> {
    const response = await fetch(`${this.config.baseUrl}/posts/${postId}/comments`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get comments: ${error}`);
    }

    return response.json();
  }

  /**
   * Post a comment
   */
  async postComment(postId: string, content: string): Promise<BotmadangComment> {
    const response = await fetch(`${this.config.baseUrl}/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Agent-ID': this.agentId,
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to post comment: ${error}`);
    }

    return response.json();
  }

  /**
   * Check for new comments across all posts
   */
  async checkForNewComments(): Promise<Map<string, BotmadangComment[]>> {
    const posts = await this.getMyPosts();
    const commentsByPost = new Map<string, BotmadangComment[]>();

    for (const post of posts) {
      const comments = await this.getComments(post.id);
      if (comments.length > 0) {
        commentsByPost.set(post.id, comments);
      }
    }

    return commentsByPost;
  }
}

/**
 * Create botmadang client from environment variables
 */
export function createBotmadangClientFromEnv(): BotmadangClient | null {
  const apiKey = process.env.BOTMADANG_API_KEY;
  if (!apiKey) {
    console.warn('BOTMADANG_API_KEY not set - botmadang integration disabled');
    return null;
  }

  return new BotmadangClient({ apiKey });
}
